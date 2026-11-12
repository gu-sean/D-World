import { Descriptions, Modal, Typography } from 'antd';
import { DateText } from '../../../components/DateText.jsx';
import { auditResult } from '../labels.js';

const preStyle = {
  margin: 0,
  padding: 12,
  maxHeight: 320,
  overflow: 'auto',
  background: 'rgba(0, 0, 0, 0.04)',
  borderRadius: 6,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
};

function JsonBlock({ title, value }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <Typography.Text strong>{title}</Typography.Text>
      {value === null || value === undefined ? (
        <div style={{ marginTop: 8, color: '#8c8c8c' }}>없음</div>
      ) : (
        <pre style={{ ...preStyle, marginTop: 8 }}>{JSON.stringify(value, null, 2)}</pre>
      )}
    </div>
  );
}

/**
 * What one audit log recorded: who did what and the values before and after the change
 * (only the fields that changed, docs/09 §0 rule 5).
 * @param {object} props
 * @param {object|null} props.log the AuditLog to show; null keeps the dialog closed
 * @param {() => void} props.onClose
 */
export function AuditLogDetailModal({ log, onClose }) {
  return (
    <Modal open={Boolean(log)} title="변경 내용" footer={null} width={720} onCancel={onClose}>
      {log && (
        <>
          <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="작업">{log.action}</Descriptions.Item>
            <Descriptions.Item label="관리자">{log.adminLoginId}</Descriptions.Item>
            <Descriptions.Item label="기록 시각">
              <DateText value={log.recordedAt} format="YYYY-MM-DD HH:mm:ss" />
            </Descriptions.Item>
            <Descriptions.Item label="결과">
              {auditResult[log.result]?.text ?? log.result}
            </Descriptions.Item>
            <Descriptions.Item label="사유">{log.reason ?? '-'}</Descriptions.Item>
          </Descriptions>
          <div style={{ display: 'flex', gap: 16 }}>
            <JsonBlock title="변경 전" value={log.beforeValue} />
            <JsonBlock title="변경 후" value={log.afterValue} />
          </div>
        </>
      )}
    </Modal>
  );
}
