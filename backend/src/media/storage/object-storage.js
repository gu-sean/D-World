import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * DI 토큰: 객체 저장소 구현
 *   presignPut({ key, contentType, contentLength, checksumSha256?, expiresInSec }) → { url, headers }
 *   head(key) → { size, contentType, checksumSha256? } | null
 *   presignGet({ key, expiresInSec }) → url
 *   delete(key) → void (이미 없으면 성공)
 * checksumSha256은 소문자 hex 64자(DB 형식)
 */
export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

const hexToBase64 = (hex) => Buffer.from(hex, 'hex').toString('base64');
const base64ToHex = (value) => Buffer.from(value, 'base64').toString('hex');

/** Cloudflare R2(S3 호환) */
class R2ObjectStorage {
  constructor({ accountId, accessKeyId, secretAccessKey, bucket, endpoint }) {
    this.bucket = bucket;
    this.client = new S3Client({
      region: 'auto',
      // 개발 MinIO 등은 R2_ENDPOINT로 지정, 없으면 R2 계정 주소
      endpoint: endpoint || `https://${accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  /** 버킷이 없으면 생성 (로컬 MinIO 전용, R2_CREATE_BUCKET=true) */
  async ensureBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  async presignPut({
    key,
    contentType,
    contentLength,
    checksumSha256,
    expiresInSec,
  }) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
      ...(checksumSha256
        ? { ChecksumSHA256: hexToBase64(checksumSha256) }
        : {}),
    });
    // 형식·크기는 서명에 포함해 신고와 다른 요청을 막고, 어긋난 경우는 complete 단계의 head 확인이 한 번 더 걸러냄
    const url = await getSignedUrl(this.client, command, {
      expiresIn: expiresInSec,
      signableHeaders: new Set(['content-type', 'content-length']),
      ...(checksumSha256
        ? { unhoistableHeaders: new Set(['x-amz-checksum-sha256']) }
        : {}),
    });
    return {
      url,
      headers: {
        'Content-Type': contentType,
        ...(checksumSha256
          ? { 'x-amz-checksum-sha256': hexToBase64(checksumSha256) }
          : {}),
      },
    };
  }

  async head(key) {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ChecksumMode: 'ENABLED',
        }),
      );
      return {
        size: Number(response.ContentLength),
        contentType: response.ContentType ?? null,
        checksumSha256: response.ChecksumSHA256
          ? base64ToHex(response.ChecksumSHA256)
          : null,
      };
    } catch (error) {
      if (
        error?.name === 'NotFound' ||
        error?.$metadata?.httpStatusCode === 404
      )
        return null;
      throw error;
    }
  }

  presignGet({ key, expiresInSec }) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      {
        expiresIn: expiresInSec,
      },
    );
  }

  async delete(key) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}

/**
 * 개발·테스트용 메모리 저장소, 운영에서는 환경 변수 검증이 막음
 * 테스트는 simulateUpload로 클라이언트 업로드를 모사
 */
class MemoryObjectStorage {
  objects = new Map();

  async presignPut({ key, contentType, contentLength, expiresInSec }) {
    return {
      url: `memory://put/${key}?expires=${expiresInSec}&length=${contentLength}`,
      headers: { 'Content-Type': contentType },
    };
  }

  async head(key) {
    return this.objects.get(key) ?? null;
  }

  async presignGet({ key, expiresInSec }) {
    return `memory://get/${key}?expires=${expiresInSec}`;
  }

  async delete(key) {
    this.objects.delete(key);
  }

  /** 테스트용: 클라이언트가 presign한 URL로 객체를 올린 상황 */
  simulateUpload(key, { size, contentType, checksumSha256 = null }) {
    this.objects.set(key, { size, contentType, checksumSha256 });
  }

  has(key) {
    return this.objects.has(key);
  }
}

export function createObjectStorage(config) {
  if (config.get('STORAGE_DRIVER') === 'r2') {
    return new R2ObjectStorage({
      accountId: config.get('R2_ACCOUNT_ID'),
      accessKeyId: config.get('R2_ACCESS_KEY_ID'),
      secretAccessKey: config.get('R2_SECRET_ACCESS_KEY'),
      bucket: config.get('R2_BUCKET'),
      endpoint: config.get('R2_ENDPOINT'),
    });
  }
  return new MemoryObjectStorage();
}
