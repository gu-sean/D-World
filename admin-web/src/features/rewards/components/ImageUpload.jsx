import { useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { Image, Typography, Upload } from 'antd';
import { uploadImage } from '../api.js';
import { MAX_IMAGE_BYTES } from './labels.js';

const ALLOWED = ['image/png', 'image/webp', 'image/jpeg'];
// The upload ticket API needs a reason; the form's own reason covers the whole change.
const UPLOAD_REASON = '관리자 이미지 업로드';

/**
 * Image field for a Form.Item: the value is the asset id, `onChange` gets the new asset id.
 * `ownerId` is the item the image belongs to (an existing id, or the uuid chosen in advance).
 */
export default function ImageUpload({ value, onChange, assetKind, ownerId, previewUrl }) {
  const [url, setUrl] = useState(previewUrl);
  const [state, setState] = useState({ loading: false, error: '' });

  const beforeUpload = async (file) => {
    if (!ALLOWED.includes(file.type)) {
      setState({ loading: false, error: 'PNG, WEBP, JPG 파일만 올릴 수 있어요.' });
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setState({ loading: false, error: '파일은 2MB 이하여야 해요.' });
      return Upload.LIST_IGNORE;
    }
    setState({ loading: true, error: '' });
    try {
      const result = await uploadImage({ file, assetKind, ownerId, reason: UPLOAD_REASON });
      setUrl(result.imageUrl);
      onChange?.(result.assetId);
      setState({ loading: false, error: '' });
    } catch (error) {
      setState({ loading: false, error: error.message });
    }
    return Upload.LIST_IGNORE;
  };

  return (
    <div>
      <Upload
        accept={ALLOWED.join(',')}
        showUploadList={false}
        beforeUpload={beforeUpload}
        disabled={state.loading}
      >
        {url ? (
          <Image src={url} width={80} height={80} preview={false} style={{ objectFit: 'cover' }} />
        ) : (
          <div
            style={{
              width: 80,
              height: 80,
              display: 'grid',
              placeItems: 'center',
              border: '1px dashed #d9d9d9',
            }}
          >
            <PlusOutlined />
          </div>
        )}
      </Upload>
      <Typography.Text type={state.error ? 'danger' : 'secondary'} style={{ display: 'block' }}>
        {state.loading
          ? '올리는 중...'
          : state.error || (value ? '이미지 준비됨' : '이미지를 선택해 주세요.')}
      </Typography.Text>
    </div>
  );
}
