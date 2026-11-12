import { useState } from 'react';
import { Button, Descriptions, message, Space, Tabs, Tag, Typography } from 'antd';
import { Link, useParams } from 'react-router';
import { ConfirmActionModal } from '../../../components/ConfirmActionModal.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { MaskedText } from '../../../components/MaskedText.jsx';
import { QueryBoundary } from '../../../components/QueryBoundary.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { AccountActionsTable } from '../components/AccountActionsTable.jsx';
import { UserActivityTab } from '../components/UserActivityTab.jsx';
import { useLiftAccountAction, useUser } from '../queries.js';

function BasicTab({ user }) {
  const [liftTarget, setLiftTarget] = useState(null);
  const lift = useLiftAccountAction();

  const items = [
    { key: 'nickname', label: '닉네임', children: user.nickname ?? '-' },
    { key: 'status', label: '상태', children: <StatusTag kind="userStatus" value={user.status} /> },
    { key: 'phone', label: '휴대폰', children: <MaskedText value={user.maskedPhoneNumber} /> },
    { key: 'email', label: '이메일', children: <MaskedText value={user.maskedEmail} /> },
    { key: 'providers', label: '로그인 방식', children: user.providers.join(', ') || '-' },
    { key: 'points', label: '보유 포인트', children: user.availablePoints.toLocaleString() },
    { key: 'level', label: '레벨', children: user.levelNo },
    { key: 'streak', label: '연속 일수', children: user.streakDays },
    { key: 'goals', label: '목표 수', children: user.goalCount },
    { key: 'missions', label: '완료 미션 수', children: user.completedMissionCount },
    { key: 'last', label: '마지막 활동', children: <DateText value={user.lastActivityAt} /> },
    { key: 'created', label: '가입일', children: <DateText value={user.createdAt} /> },
    {
      key: 'restriction',
      label: '이용 제한',
      children: user.restriction ? (
        <Tag color="error">
          <DateText value={user.restriction.endsAt} />
          까지
        </Tag>
      ) : (
        '-'
      ),
    },
  ];

  return (
    <>
      <Descriptions bordered size="small" column={2} items={items} />
      <Space style={{ margin: '24px 0 12px' }}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          계정 조치
        </Typography.Title>
        <Link to={`/users/${user.id}/actions/new`}>
          <Button type="primary">계정 조치 만들기</Button>
        </Link>
      </Space>
      <AccountActionsTable actions={user.accountActions} onLift={setLiftTarget} />
      <ConfirmActionModal
        open={liftTarget !== null}
        title="이용 제한 해제"
        summary={`${user.nickname ?? '회원'} · 이용 제한을 해제해요.`}
        onSubmit={async ({ reason, idempotencyKey }) => {
          await lift.mutateAsync({
            actionId: liftTarget.id,
            body: { reason },
            idempotencyKey,
          });
          message.success('처리했어요');
          setLiftTarget(null);
        }}
        onCancel={() => setLiftTarget(null)}
      />
    </>
  );
}

/** ADM-03 회원 상세 (M11, M12, M14): tabs "기본" and "활동". */
export default function UserDetailPage() {
  const { userId } = useParams();
  const query = useUser(userId);

  return (
    <>
      <Typography.Title level={3}>회원 상세</Typography.Title>
      <QueryBoundary query={query}>
        {(user) => (
          <Tabs
            items={[
              { key: 'basic', label: '기본', children: <BasicTab user={user} /> },
              { key: 'activity', label: '활동', children: <UserActivityTab userId={userId} /> },
            ]}
          />
        )}
      </QueryBoundary>
    </>
  );
}
