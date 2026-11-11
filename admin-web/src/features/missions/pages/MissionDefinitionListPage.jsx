// ADM-13 Mission definition list
import { useState } from 'react';
import { Button, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { Link } from 'react-router';
import QueryState from '../../../components/QueryState.jsx';
import {
  EXERCISE_OPTIONS,
  formatDateTime,
  ORIGIN_LABELS,
  PAGE_SIZE,
  STATUS_LABELS,
  labelOf,
} from '../constants.js';
import { useCatalog, useDefinitions } from '../queries.js';

export default function MissionDefinitionListPage() {
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const params = { ...filters, page, size: PAGE_SIZE, sort: 'createdAt,desc' };
  const { data, isLoading, error, refetch, isFetching } = useDefinitions(params);
  const { data: categories = [] } = useCatalog('categories');

  const setFilter = (key, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const categoryName = (id) => categories.find((category) => category.id === id)?.name ?? '-';

  const columns = [
    { title: '제목', dataIndex: 'title' },
    { title: '구분', dataIndex: 'origin', render: (value) => ORIGIN_LABELS[value] ?? value },
    { title: '분야', dataIndex: 'categoryId', render: categoryName },
    {
      title: '운동',
      dataIndex: 'exerciseCode',
      render: (value) => labelOf(EXERCISE_OPTIONS, value),
    },
    {
      title: '공개 상태',
      dataIndex: 'publicationStatus',
      render: (value) => <Tag>{STATUS_LABELS[value] ?? value}</Tag>,
    },
    { title: '등록일', dataIndex: 'createdAt', render: formatDateTime },
    {
      title: '',
      render: (_, row) =>
        row.origin === 'admin' ? (
          <Link to={`/missions/definitions/${row.id}/edit`}>수정</Link>
        ) : (
          <Link to="/missions/reviews">검수</Link>
        ),
    },
  ];

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          미션 정의
        </Typography.Title>
        <Link to="/missions/definitions/new">
          <Button type="primary">미션 등록</Button>
        </Link>
      </Space>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="제목 검색"
          onSearch={(value) => setFilter('query', value)}
        />
        <Select
          allowClear
          placeholder="구분"
          style={{ width: 120 }}
          options={Object.entries(ORIGIN_LABELS).map(([value, label]) => ({ value, label }))}
          onChange={(value) => setFilter('origin', value)}
        />
        <Select
          allowClear
          placeholder="공개 상태"
          style={{ width: 140 }}
          options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          onChange={(value) => setFilter('publicationStatus', value)}
        />
        <Select
          allowClear
          placeholder="분야"
          style={{ width: 160 }}
          options={categories.map((category) => ({ value: category.id, label: category.name }))}
          onChange={(value) => setFilter('categoryId', value)}
        />
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
            current: page,
            pageSize: PAGE_SIZE,
            total: data?.totalCount,
            showSizeChanger: false,
            onChange: setPage,
          }}
        />
      </QueryState>
    </div>
  );
}
