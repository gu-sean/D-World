// ADM-18 Challenge operation list
import { useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Dropdown, Select, Space, Table, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router';
import QueryState from '../../../components/QueryState.jsx';
import { confirmWithReason } from '../confirmWithReason.jsx';
import { label, ORIGIN, PHASE, PUBLICATION_STATUS, SETTLEMENT_STATUS } from '../labels.js';
import { useChallengeAction, useChallenges, useReviewChallenge } from '../queries.js';

const toOptions = (map) =>
  Object.entries(map).map(([value, item]) => ({
    value,
    label: typeof item === 'object' ? item.label : item,
  }));

const SETTLEMENT_FILTER = toOptions(SETTLEMENT_STATUS);

export default function ChallengeListPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [filters, setFilters] = useState({});
  const [paging, setPaging] = useState({ page: 1, size: 20 });
  const params = { ...filters, ...paging, sort: 'startDate,desc' };
  const { data, isLoading, error, refetch, isFetching } = useChallenges(params);
  const action = useChallengeAction();
  const review = useReviewChallenge();

  const setFilter = (name) => (value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPaging((prev) => ({ ...prev, page: 1 }));
  };

  const runAction = (row, kind, title, danger) =>
    confirmWithReason({
      title,
      description: `「${row.title}」`,
      okText: title,
      danger,
      onConfirm: async (reason) => {
        await action.mutateAsync({ id: row.id, action: kind, reason });
        message.success('변경 사항을 저장했습니다.');
      },
    });

  const runReview = (row, decision, title, danger) =>
    confirmWithReason({
      title,
      description: `「${row.title}」`,
      okText: title,
      danger,
      onConfirm: async (reason) => {
        await review.mutateAsync({ id: row.id, decision, reason });
        message.success('변경 사항을 저장했습니다.');
      },
    });

  const menuFor = (row) => {
    const items = [];
    if (row.origin === 'admin' && !['cancelled'].includes(row.publicationStatus)) {
      items.push({
        key: 'edit',
        label: '수정',
        onClick: () => navigate(`/challenges/${row.id}/edit`),
      });
    }
    if (row.origin === 'admin' && row.publicationStatus === 'draft') {
      items.push({
        key: 'publish',
        label: '공개',
        onClick: () => runAction(row, 'publish', '공개'),
      });
    }
    if (row.origin === 'user' && row.publicationStatus === 'review_pending') {
      items.push(
        { key: 'approve', label: '검수 승인', onClick: () => runReview(row, 'approved', '승인') },
        {
          key: 'reject',
          label: '검수 반려',
          danger: true,
          onClick: () => runReview(row, 'rejected', '반려', true),
        },
      );
    }
    if (row.publicationStatus === 'public') {
      items.push({
        key: 'hide',
        label: '숨김',
        danger: true,
        onClick: () => runAction(row, 'hide', '숨김', true),
      });
    }
    if (['public', 'hidden'].includes(row.publicationStatus)) {
      items.push({
        key: 'cancel',
        label: '취소',
        danger: true,
        onClick: () => runAction(row, 'cancel', '챌린지 취소', true),
      });
    }
    return items;
  };

  const columns = [
    {
      title: '챌린지',
      dataIndex: 'title',
      render: (title, row) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{title}</Typography.Text>
          <Typography.Text type="secondary">
            {label(ORIGIN, row.origin)}
            {row.creatorNickname ? ` · ${row.creatorNickname}` : ''}
          </Typography.Text>
        </Space>
      ),
    },
    { title: '기간', render: (_, row) => `${row.startDate} ~ ${row.endDate}` },
    { title: '진행', dataIndex: 'phase', render: (value) => label(PHASE, value) },
    {
      title: '공개 상태',
      dataIndex: 'publicationStatus',
      render: (value) => {
        const item = PUBLICATION_STATUS[value];
        return <Tag color={item?.color}>{item?.label ?? value}</Tag>;
      },
    },
    {
      title: '참가자',
      render: (_, row) =>
        `${row.participantCount}${row.maxParticipants ? ` / ${row.maxParticipants}` : ''}`,
    },
    {
      title: '정산',
      dataIndex: 'settlementStatus',
      render: (value) => label(SETTLEMENT_STATUS, value),
    },
    {
      title: '처리',
      render: (_, row) => {
        const items = menuFor(row);
        return (
          <Space>
            <Button size="small" onClick={() => navigate(`/challenges/${row.id}/rankings`)}>
              순위
            </Button>
            <Button size="small" onClick={() => navigate(`/challenges/${row.id}/settlement`)}>
              정산
            </Button>
            {items.length > 0 && (
              <Dropdown menu={{ items }} trigger={['click']}>
                <Button size="small">더보기</Button>
              </Dropdown>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          챌린지 운영 목록
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/challenges/new')}>
          공식 챌린지 등록
        </Button>
      </Space>
      <Space wrap>
        <Select
          allowClear
          placeholder="공개 상태"
          style={{ width: 140 }}
          aria-label="공개 상태"
          options={toOptions(PUBLICATION_STATUS)}
          onChange={setFilter('publicationStatus')}
        />
        <Select
          allowClear
          placeholder="진행 단계"
          style={{ width: 130 }}
          aria-label="진행 단계"
          options={toOptions(PHASE)}
          onChange={setFilter('phase')}
        />
        <Select
          allowClear
          placeholder="출처"
          style={{ width: 110 }}
          aria-label="출처"
          options={toOptions(ORIGIN)}
          onChange={setFilter('origin')}
        />
        <Select
          allowClear
          placeholder="정산 상태"
          style={{ width: 130 }}
          aria-label="정산 상태"
          options={SETTLEMENT_FILTER}
          onChange={setFilter('settlementStatus')}
        />
        <Button
          onClick={() => {
            setFilters({});
            setPaging({ page: 1, size: 20 });
          }}
        >
          필터 초기화
        </Button>
      </Space>
      <QueryState
        loading={isLoading}
        error={error}
        onRetry={refetch}
        empty={data?.items.length === 0}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data?.items}
          loading={isFetching}
          pagination={{
            current: paging.page,
            pageSize: paging.size,
            total: data?.totalCount,
            showSizeChanger: false,
            onChange: (page) => setPaging((prev) => ({ ...prev, page })),
          }}
        />
      </QueryState>
    </Space>
  );
}
