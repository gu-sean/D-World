// ADM-22 Point transaction list
import { useState } from 'react';
import { Button, DatePicker, Form, Input, Select, Space, Statistic, Table, Typography } from 'antd';
import dayjs from 'dayjs';
import { Link } from 'react-router';
import StatePanel from '../../../components/StatePanel.jsx';
import {} from '../components/formBits.jsx';
import { formatTime } from '../components/helpers.js';
import { SOURCE_TYPES, TRANSACTION_KINDS } from '../components/labels.js';
import { usePointTransactions } from '../queries.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const options = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }));
const signed = (n) => (n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString());

export default function PointTransactionListPage() {
  const [filters, setFilters] = useState({});
  const [paging, setPaging] = useState({ page: 1, size: 20, sort: 'occurredAt,desc' });
  const query = usePointTransactions({ ...filters, ...paging });

  const onSearch = ({ userId, kind, sourceType, range }) => {
    setFilters({
      userId: userId?.trim() || undefined,
      kind,
      sourceType,
      from: range?.[0]?.startOf('day').toISOString(),
      // `to` is exclusive: the whole last day is included.
      to: range?.[1]?.add(1, 'day').startOf('day').toISOString(),
    });
    setPaging((prev) => ({ ...prev, page: 1 }));
  };

  const columns = [
    { title: '시각', dataIndex: 'occurredAt', render: formatTime, width: 160 },
    { title: '회원', dataIndex: 'userId', ellipsis: true, width: 120 },
    { title: '종류', dataIndex: 'kind', render: (kind) => TRANSACTION_KINDS[kind] ?? kind },
    {
      title: '출처',
      dataIndex: 'sourceType',
      render: (type) => SOURCE_TYPES[type] ?? type,
    },
    {
      title: '가용 변동',
      dataIndex: 'availableDelta',
      align: 'right',
      render: (n) => (
        <Typography.Text type={n < 0 ? 'danger' : undefined}>{signed(n)}</Typography.Text>
      ),
    },
    { title: '잔액', dataIndex: 'balanceAfter', align: 'right', render: (n) => n.toLocaleString() },
    {
      title: '미회수',
      dataIndex: 'outstandingAfter',
      align: 'right',
      render: (n) => n.toLocaleString(),
    },
    { title: '사유', dataIndex: 'reason', ellipsis: true, render: (reason) => reason ?? '-' },
  ];

  const data = query.data;
  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          포인트 내역
        </Typography.Title>
        <Link to="/rewards/points/adjust">
          <Button type="primary">포인트 수동 조정</Button>
        </Link>
      </Space>

      <Form layout="inline" onFinish={onSearch} style={{ rowGap: 12, marginBottom: 16 }}>
        <Form.Item
          name="userId"
          rules={[
            {
              validator: (_, v) =>
                !v?.trim() || UUID.test(v.trim())
                  ? Promise.resolve()
                  : Promise.reject(new Error('회원 ID 형식을 확인해 주세요.')),
            },
          ]}
        >
          <Input placeholder="회원 ID" allowClear style={{ width: 300 }} />
        </Form.Item>
        <Form.Item name="kind">
          <Select
            placeholder="종류"
            allowClear
            options={options(TRANSACTION_KINDS)}
            style={{ width: 140 }}
          />
        </Form.Item>
        <Form.Item name="sourceType">
          <Select
            placeholder="출처"
            allowClear
            options={options(SOURCE_TYPES)}
            style={{ width: 140 }}
          />
        </Form.Item>
        <Form.Item name="range">
          <DatePicker.RangePicker disabledDate={(d) => d.isAfter(dayjs(), 'day')} />
        </Form.Item>
        <Button htmlType="submit" type="primary">
          조회
        </Button>
        <Button
          onClick={() => {
            setFilters({});
            setPaging((prev) => ({ ...prev, page: 1 }));
          }}
          htmlType="reset"
        >
          검색 조건 초기화
        </Button>
      </Form>

      <StatePanel
        loading={query.isLoading}
        error={query.error}
        empty={data?.items.length === 0}
        onRetry={query.refetch}
      >
        {data && (
          <>
            <Statistic
              title="검수 대기 중인 보상 합계"
              value={data.pendingPoints}
              suffix="P"
              style={{ marginBottom: 16 }}
            />
            <Table
              rowKey="id"
              columns={columns}
              dataSource={data.items}
              loading={query.isFetching}
              pagination={{
                current: data.page,
                pageSize: data.size,
                total: data.totalCount,
                showSizeChanger: true,
                onChange: (page, size) => setPaging((prev) => ({ ...prev, page, size })),
              }}
              scroll={{ x: 'max-content' }}
            />
          </>
        )}
      </StatePanel>
    </div>
  );
}
