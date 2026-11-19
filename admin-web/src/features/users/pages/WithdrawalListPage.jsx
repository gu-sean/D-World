import { useState } from 'react';
import { Button, Space } from 'antd';
import { message } from '../../../lib/message.jsx';
import { ConfirmActionModal } from '../../../components/ConfirmActionModal.jsx';
import { DataTable } from '../../../components/DataTable.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { MEMBER_FIELD, memberColumn } from '../../../components/memberColumns.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { labels } from '../../../constants/labels.js';
import { useUpdateWithdrawal, useWithdrawals } from '../queries.js';
import { t } from '../../../i18n/index.js';
import { PageHeader } from '../../../components/PageHeader.jsx';
import { ListCard } from '../../../components/ListCard.jsx';

const DEFAULT_SORT = 'requestedAt,desc'; // newest first (all lists: newest date on top)

const FIELDS = [
  MEMBER_FIELD,
  {
    name: 'status',
    type: 'select',
    label: t('상태'),
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
  on_hold: { title: t('탈퇴 요청 보류'), note: t('요청을 보류해요.'), danger: false },
  processing: {
    title: t('탈퇴 처리 시작'),
    note: t('처리를 시작하면 되돌릴 수 없어요. 회원의 데이터가 삭제·익명화돼요.'),
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
      title: t('상태'),
      dataIndex: 'status',
      render: (value) => <StatusTag kind="withdrawalRequestStatus" value={value} />,
    },
    {
      title: t('요청일'),
      dataIndex: 'requestedAt',
      key: 'requestedAt',
      sorter: true,
      render: (value) => <DateText value={value} />,
    },
    { title: t('검토일'), dataIndex: 'reviewedAt', render: (value) => <DateText value={value} /> },
    { title: t('보류 사유'), dataIndex: 'reason', render: (value) => value ?? '-' },
    {
      title: t('처리 범위'),
      dataIndex: 'dataScope',
      render: ({ deleteCount, anonymizeCount, retainCount }) =>
        t('삭제 {0} · 익명화 {1} · 보관 {2}', deleteCount, anonymizeCount, retainCount),
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
            {t('보류')}
          </Button>
          <Button
            size="small"
            danger
            disabled={!CAN_PROCESS.includes(request.status)}
            onClick={() => setTarget({ request, status: 'processing' })}
          >
            {t('처리 시작')}
          </Button>
        </Space>
      ),
    },
  ];

  const action = target ? ACTIONS[target.status] : null;

  return (
    <>
      <PageHeader
        title={t('탈퇴 요청')}
        description={t('탈퇴를 요청한 회원을 확인하고 처리해요.')}
      />
      <ListCard>
        <FilterBar fields={FIELDS} value={params} onChange={setParams} />
        <DataTable query={query} columns={columns} defaultSort={DEFAULT_SORT} />
      </ListCard>
      <ConfirmActionModal
        open={target !== null}
        title={action?.title ?? ''}
        summary={action ? `${target.request.nickname ?? t('회원')} · ${action.note}` : null}
        danger={action?.danger}
        onSubmit={async ({ reason, idempotencyKey }) => {
          await update.mutateAsync({
            requestId: target.request.id,
            body: { status: target.status, reason },
            idempotencyKey,
          });
          message.success(t('처리했어요'));
          setTarget(null);
        }}
        onCancel={() => setTarget(null)}
      />
    </>
  );
}
