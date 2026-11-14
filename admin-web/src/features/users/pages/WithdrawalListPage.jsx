import { useState } from 'react';
import { Button, message, Space, Typography } from 'antd';
import { ConfirmActionModal } from '../../../components/ConfirmActionModal.jsx';
import { DataTable } from '../../../components/DataTable.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { MEMBER_FIELD, memberColumn } from '../../../components/memberColumns.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { labels } from '../../../constants/labels.js';
import { useUpdateWithdrawal, useWithdrawals } from '../queries.js';

const DEFAULT_SORT = 'requestedAt,asc'; // docs/09 M15: oldest request first

const FIELDS = [
  MEMBER_FIELD,
  {
    name: 'status',
    type: 'select',
    label: '상태',
    options: Object.entries(labels.withdrawalRequestStatus).map(([value, { text }]) => ({
      value,
      label: text,
    })),
  },
];

// What M16 can do from each status (docs/11 §3.6).
const CAN_HOLD = ['requested'];
const CAN_PROCESS = ['requested', 'on_hold'];

const ACTIONS = {
  on_hold: { title: '탈퇴 요청 보류', note: '요청을 보류해요.', danger: false },
  processing: {
    title: '탈퇴 처리 시작',
    note: '처리를 시작하면 되돌릴 수 없어요. 회원의 데이터가 삭제·익명화돼요.',
    danger: true,
  },
};

/** ADM-05 탈퇴 요청 (M15, M16): hold a request or start the withdrawal job. */
export default function WithdrawalListPage() {
  const [params, setParams] = useListParams({ sort: DEFAULT_SORT });
  const query = useWithdrawals(params);
  const update = useUpdateWithdrawal();
  const [target, setTarget] = useState(null); // {request, status}

  const columns = [
    memberColumn({ idKey: 'userId', nicknameKey: 'nickname' }),
    {
      title: '상태',
      dataIndex: 'status',
      render: (value) => <StatusTag kind="withdrawalRequestStatus" value={value} />,
    },
    {
      title: '요청일',
      dataIndex: 'requestedAt',
      key: 'requestedAt',
      sorter: true,
      render: (value) => <DateText value={value} />,
    },
    { title: '검토일', dataIndex: 'reviewedAt', render: (value) => <DateText value={value} /> },
    { title: '보류 사유', dataIndex: 'reason', render: (value) => value ?? '-' },
    {
      title: '처리 범위',
      dataIndex: 'dataScope',
      render: ({ deleteCount, anonymizeCount, retainCount }) =>
        `삭제 ${deleteCount} · 익명화 ${anonymizeCount} · 보관 ${retainCount}`,
    },
    {
      title: '',
      key: 'actions',
      render: (_, request) => (
        <Space>
          <Button
            size="small"
            disabled={!CAN_HOLD.includes(request.status)}
            onClick={() => setTarget({ request, status: 'on_hold' })}
          >
            보류
          </Button>
          <Button
            size="small"
            danger
            disabled={!CAN_PROCESS.includes(request.status)}
            onClick={() => setTarget({ request, status: 'processing' })}
          >
            처리 시작
          </Button>
        </Space>
      ),
    },
  ];

  const action = target ? ACTIONS[target.status] : null;

  return (
    <>
      <Typography.Title level={3}>탈퇴 요청</Typography.Title>
      <FilterBar fields={FIELDS} value={params} onChange={setParams} />
      <DataTable query={query} columns={columns} defaultSort={DEFAULT_SORT} />
      <ConfirmActionModal
        open={target !== null}
        title={action?.title ?? ''}
        summary={action ? `${target.request.nickname ?? '회원'} · ${action.note}` : null}
        danger={action?.danger}
        onSubmit={async ({ reason, idempotencyKey }) => {
          await update.mutateAsync({
            requestId: target.request.id,
            body: { status: target.status, reason },
            idempotencyKey,
          });
          message.success('처리했어요');
          setTarget(null);
        }}
        onCancel={() => setTarget(null)}
      />
    </>
  );
}
