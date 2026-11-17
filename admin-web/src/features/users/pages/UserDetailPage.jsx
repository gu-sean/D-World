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
import { t } from '../../../i18n/index.js';

function BasicTab({ user }) {
  const [liftTarget, setLiftTarget] = useState(null);
  const lift = useLiftAccountAction();

  const items = [
    { key: 'nickname', label: t('닉네임'), children: user.nickname ?? '-' },
    {
      key: 'id',
      label: t('회원 ID'),
      // 다른 목록의 검색칸에 그대로 붙여 넣을 수 있게 전체를 보이고 복사 버튼을 둔다
      children: (
        <Typography.Text copyable={{ tooltips: [t('회원 ID 복사'), t('복사했어요')] }} code>
          {user.id}
        </Typography.Text>
      ),
    },
    {
      key: 'status',
      label: t('상태'),
      children: <StatusTag kind="userStatus" value={user.status} />,
    },
    { key: 'phone', label: t('휴대폰'), children: <MaskedText value={user.maskedPhoneNumber} /> },
    { key: 'email', label: t('이메일'), children: <MaskedText value={user.maskedEmail} /> },
    { key: 'providers', label: t('로그인 방식'), children: user.providers.join(', ') || '-' },
    { key: 'points', label: t('보유 포인트'), children: user.availablePoints.toLocaleString() },
    { key: 'streak', label: t('연속 일수'), children: user.streakDays },
    { key: 'goals', label: t('목표 수'), children: user.goalCount },
    { key: 'missions', label: t('완료 미션 수'), children: user.completedMissionCount },
    { key: 'last', label: t('마지막 활동'), children: <DateText value={user.lastActivityAt} /> },
    { key: 'created', label: t('가입일'), children: <DateText value={user.createdAt} /> },
    {
      key: 'restriction',
      label: t('이용 제한'),
      children: user.restriction ? (
        <Tag color="error">
          <DateText value={user.restriction.endsAt} />
          {t('까지')}
        </Tag>
      ) : (
        '-'
      ),
    },
  ];

  return (
    <>
      <Descriptions bordered size="small" column={2} items={items} />
      {/* 이 회원으로 걸러진 다른 메뉴로 바로 간다 (모든 목록의 회원 검색은 `member`) */}
      <Space wrap style={{ display: 'flex', marginTop: 16 }}>
        <Link to={`/rewards/points?member=${user.id}`}>
          <Button>{t('포인트 내역')}</Button>
        </Link>
        <Link to={`/rewards/points/adjust?userId=${user.id}`}>
          <Button>{t('포인트 조정')}</Button>
        </Link>
        <Link to={`/verifications?member=${user.id}`}>
          <Button>{t('인증 기록')}</Button>
        </Link>
        <Link to={`/support/inquiries?member=${user.id}`}>
          <Button>{t('문의')}</Button>
        </Link>
        <Link to={`/support/abuse?member=${user.id}`}>
          <Button>{t('신고')}</Button>
        </Link>
        <Link to={`/access/audit-logs?member=${user.id}`}>
          <Button>{t('관리자 처리 이력')}</Button>
        </Link>
      </Space>
      <Space style={{ margin: '24px 0 12px' }}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {t('계정 조치')}
        </Typography.Title>
        <Link to={`/users/${user.id}/actions/new`}>
          <Button type="primary">{t('계정 조치 만들기')}</Button>
        </Link>
      </Space>
      <AccountActionsTable actions={user.accountActions} onLift={setLiftTarget} />
      <ConfirmActionModal
        open={liftTarget !== null}
        title={t('이용 제한 해제')}
        summary={t('{0} · 이용 제한을 해제해요.', user.nickname ?? t('회원'))}
        onSubmit={async ({ reason, idempotencyKey }) => {
          await lift.mutateAsync({
            actionId: liftTarget.id,
            body: { reason },
            idempotencyKey,
          });
          message.success(t('처리했어요'));
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
      <Typography.Title level={3}>{t('회원 상세')}</Typography.Title>
      <QueryBoundary query={query}>
        {(user) => (
          <Tabs
            items={[
              { key: 'basic', label: t('기본'), children: <BasicTab user={user} /> },
              { key: 'activity', label: t('활동'), children: <UserActivityTab userId={userId} /> },
            ]}
          />
        )}
      </QueryBoundary>
    </>
  );
}
