import { Alert, Image, Space, Typography } from 'antd';
import { StatusTag } from '../../../components/StatusTag.jsx';

const isImage = (file) => file.mimeType?.startsWith('image/');
const isVideo = (file) => file.mimeType?.startsWith('video/');

/**
 * Evidence files of a verification record: photos and videos are shown through their short-lived
 * view URL; a file without a URL (not uploaded, or a sensor file) shows its kind and status.
 * @param {{
 *   files?: {id: string, mediaKind: string, mimeType?: string|null, status?: string, url?: string|null}[],
 *   duplicateOfMediaId?: string|null,
 * }} props
 */
export default function EvidenceViewer({ files = [], duplicateOfMediaId = null }) {
  return (
    <Space orientation="vertical" size="small" style={{ width: '100%' }}>
      {duplicateOfMediaId && (
        <Alert
          type="warning"
          showIcon
          message="이전에 제출된 파일과 같은 파일이에요."
          description={`이전 파일 ${duplicateOfMediaId}`}
        />
      )}
      {files.length === 0 ? (
        <Typography.Text type="secondary">증거 파일이 없어요.</Typography.Text>
      ) : (
        <Space wrap align="start">
          {files.map((file) => {
            if (file.url && isImage(file)) {
              return <Image key={file.id} src={file.url} width={200} alt="증거 사진" />;
            }
            if (file.url && isVideo(file)) {
              return <video key={file.id} src={file.url} width={280} controls />;
            }
            return (
              <Space key={file.id}>
                <StatusTag kind="mediaKind" value={file.mediaKind} />
                {file.status && <StatusTag kind="uploadStatus" value={file.status} />}
              </Space>
            );
          })}
        </Space>
      )}
    </Space>
  );
}
