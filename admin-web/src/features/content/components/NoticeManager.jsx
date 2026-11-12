import { useState } from 'react';
import { Alert, Button, Input, Modal, Space, Typography } from 'antd';
import { DataTable } from '../../../components/DataTable.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { labels } from '../../../constants/labels.js';
import { audienceType as audienceLabels } from '../labels.js';
import { useCancelNotice, useNotices, usePublishNotice } from '../queries.js';
import { fromInputValue, isFuture } from '../time.js';
import { useConfirm } from '../useConfirm.jsx';
import { NoticeForm } from './NoticeForm.jsx';

const optionsOf = (kind) =>
  Object.entries(labels[kind]).map(([value, { text }]) => ({ value, label: text }));

const FIELDS = [
  { name: 'status', type: 'select', label: '상태', options: optionsOf('noticeStatus') },
  { name: 'category', type: 'select', label: '분류', options: optionsOf('noticeCategory') },
];

const audienceText = (notice) =>
  notice.audienceType === 'users'
    ? `${audienceLabels.users} ${notice.userIds.length}명`
    : audienceLabels.all;

function pushText(notice) {
  if (!notice.sendPush) return '-';
  const { pending, sent, failed, skipped } = notice.pushStats;
  return `발송 ${sent} · 대기 ${pending} · 실패 ${failed} · 건너뜀 ${skipped}`;
}

/** The small dialog that asks for the time of a scheduled publication (Asia/Seoul). */
function ScheduleModal({ notice, onNext, onCancel }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(null);

  const handleOk = () => {
    if (!isFuture(text)) {
      setError('예약 시각은 지금 이후로 입력해 주세요.');
      return;
    }
    onNext(fromInputValue(text));
  };

  return (
    <Modal
      open
      title="예약 게시"
      okText="다음"
      cancelText="취소"
      onOk={handleOk}
      onCancel={onCancel}
    >
      <div style={{ marginBottom: 12 }}>{notice.title}</div>
      <Input
        type="datetime-local"
        aria-label="게시 시각"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setError(null);
        }}
      />
      {error && <Alert style={{ marginTop: 12 }} type="warning" showIcon title={error} />}
    </Modal>
  );
}

/**
 * The notice list with its form: ADM-32 (`pushMode` off) and ADM-33 (`pushMode` on, a new notice
 * is made with `sendPush = true`). A `draft` can be edited, published now or at a time, or
 * cancelled; a `scheduled` notice can only be cancelled (docs/11 §3.7).
 * @param {object} props
 * @param {string} props.title
 * @param {boolean} [props.pushMode]
 */
export function NoticeManager({ title, pushMode = false }) {
  const [params, setParams] = useListParams();
  const query = useNotices(params);
  const publish = usePublishNotice();
  const cancel = useCancelNotice();
  const [confirmElement, ask] = useConfirm();
  const [editing, setEditing] = useState(null); // null: closed, {}: new, {notice}: edit
  const [scheduling, setScheduling] = useState(null);

  const askPublish = (notice, scheduledAt) =>
    ask({
      title: scheduledAt ? '예약 게시' : '즉시 게시',
      summary: (
        <>
          {notice.title}
          <br />
          {scheduledAt
            ? '예약한 시각에 게시돼요. 예약한 공지는 고칠 수 없고, 취소하고 새로 만들어야 해요.'
            : '지금 바로 게시하고 받는 회원에게 알림이 가요.'}
        </>
      ),
      submit: ({ reason, idempotencyKey }) =>
        publish.mutateAsync({
          noticeId: notice.id,
          body: { scheduledAt: scheduledAt ?? null, reason },
          idempotencyKey,
        }),
    });

  const askCancel = (notice) =>
    ask({
      title: '공지 취소',
      danger: true,
      summary: (
        <>
          {notice.title}
          <br />
          취소한 공지는 다시 게시할 수 없어요.
        </>
      ),
      submit: ({ reason, idempotencyKey }) =>
        cancel.mutateAsync({ noticeId: notice.id, body: { reason }, idempotencyKey }),
    });

  const columns = [
    {
      title: '분류',
      dataIndex: 'category',
      render: (value) => <StatusTag kind="noticeCategory" value={value} />,
    },
    { title: '제목', dataIndex: 'title' },
    { title: '대상', key: 'audience', render: (_, notice) => audienceText(notice) },
    {
      title: '상태',
      dataIndex: 'status',
      render: (value) => <StatusTag kind="noticeStatus" value={value} />,
    },
    {
      title: '게시·예약 시각',
      key: 'time',
      render: (_, notice) => <DateText value={notice.publishedAt ?? notice.scheduledAt} />,
    },
    { title: '푸시', key: 'push', render: (_, notice) => pushText(notice) },
    {
      title: '',
      key: 'actions',
      render: (_, notice) => (
        <Space>
          {notice.status === 'draft' && (
            <>
              <Button size="small" onClick={() => setEditing({ notice })}>
                수정
              </Button>
              <Button size="small" type="primary" onClick={() => askPublish(notice)}>
                즉시 게시
              </Button>
              <Button size="small" onClick={() => setScheduling(notice)}>
                예약 게시
              </Button>
            </>
          )}
          {['draft', 'scheduled'].includes(notice.status) && (
            <Button size="small" danger onClick={() => askCancel(notice)}>
              취소
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3}>{title}</Typography.Title>
        {!editing && (
          <Button type="primary" onClick={() => setEditing({})}>
            {pushMode ? '푸시 알림 만들기' : '공지 만들기'}
          </Button>
        )}
      </Space>
      {editing && (
        <div style={{ marginBottom: 24 }}>
          <NoticeForm
            // A new form for every notice: the form keeps its own state.
            key={editing.notice?.id ?? 'new'}
            notice={editing.notice}
            pushMode={pushMode}
            onConfirm={ask}
            onClose={() => setEditing(null)}
          />
        </div>
      )}
      <FilterBar fields={FIELDS} value={params} onChange={setParams} />
      <DataTable query={query} columns={columns} />
      {scheduling && (
        <ScheduleModal
          notice={scheduling}
          onCancel={() => setScheduling(null)}
          onNext={(scheduledAt) => {
            const notice = scheduling;
            setScheduling(null);
            askPublish(notice, scheduledAt);
          }}
        />
      )}
      {confirmElement}
    </>
  );
}
