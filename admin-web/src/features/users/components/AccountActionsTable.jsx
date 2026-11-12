import { Button, Table } from 'antd';
import { DateText } from '../../../components/DateText.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';

// An action is "in force" when it is a restriction that has not ended and was not lifted
// (docs/11 §3.8).
const isInForce = (action) =>
  action.actionType === 'restriction' &&
  !action.liftedAt &&
  action.endsAt !== null &&
  new Date(action.endsAt) > new Date();

/**
 * The recent account actions of a user (`AdminUserDetail.accountActions`, at most 10).
 * @param {object} props
 * @param {object[]} props.actions
 * @param {(action: object) => void} props.onLift called for "해제" of a restriction in force
 */
export function AccountActionsTable({ actions, onLift }) {
  const columns = [
    {
      title: '종류',
      dataIndex: 'actionType',
      render: (value) => <StatusTag kind="accountActionType" value={value} />,
    },
    { title: '사유', dataIndex: 'reason' },
    { title: '시작', dataIndex: 'startsAt', render: (value) => <DateText value={value} /> },
    { title: '종료', dataIndex: 'endsAt', render: (value) => <DateText value={value} /> },
    { title: '해제', dataIndex: 'liftedAt', render: (value) => <DateText value={value} /> },
    { title: '담당', dataIndex: 'adminLoginId' },
    {
      title: '',
      key: 'lift',
      render: (_, action) =>
        isInForce(action) ? (
          <Button size="small" danger onClick={() => onLift(action)}>
            해제
          </Button>
        ) : null,
    },
  ];
  return (
    <Table rowKey="id" size="small" pagination={false} columns={columns} dataSource={actions} />
  );
}
