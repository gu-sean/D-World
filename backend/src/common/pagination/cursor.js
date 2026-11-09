import { BadRequestException } from '@nestjs/common';

/**
 * 시간 역순 목록의 커서: (시각 텍스트, id) 쌍
 * 시각은 마이크로초 정밀도를 유지하려고 텍스트(created_at::text)로 주고받는다
 */
export function encodeCursor(row, timeKey) {
  return Buffer.from(JSON.stringify({ t: row[timeKey], id: row.id })).toString(
    'base64url',
  );
}

/** 커서 → { t, id } (없으면 둘 다 null), 형식이 틀리면 400 */
export function decodeCursor(cursor) {
  if (cursor === undefined) return { t: null, id: null };
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (typeof value.t !== 'string' || typeof value.id !== 'string') {
      throw new Error('invalid');
    }
    return { t: value.t, id: value.id };
  } catch {
    throw new BadRequestException(['cursor: 올바르지 않음']);
  }
}
