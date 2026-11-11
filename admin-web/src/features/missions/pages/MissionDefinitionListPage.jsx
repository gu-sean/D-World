// ADM-13 미션 틀 목록
import { Button, Space, Typography } from 'antd';
import { Link } from 'react-router';
import { DataTable } from '../../../components/DataTable.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { EXERCISE_OPTIONS, FILTER_STATUS_OPTIONS, labelOf, ORIGIN_OPTIONS } from '../constants.js';
import { useCatalog, useDefinitions } from '../queries.js';

export default function MissionDefinitionListPage() {
  const [params, setParams] = useListParams({ sort: 'createdAt,desc' }); // API default (docs/09)
  const query = useDefinitions(params);
  const { data: categories = [] } = useCatalog('categories');
  const categoryName = (id) => categories.find((category) => category.id === id)?.name ?? '-';

  const fields = [
    { name: 'query', type: 'text', label: '제목 검색' },
    { name: 'origin', type: 'select', label: '구분', options: ORIGIN_OPTIONS },
    {
      name: 'publicationStatus',
      type: 'select',
      label: '공개 상태',
      options: FILTER_STATUS_OPTIONS,
    },
    {
      name: 'categoryId',
      type: 'select',
      label: '분야',
      options: categories.map((category) => ({ value: category.id, label: category.name })),
    },
  ];

  const columns = [
    { title: '제목', dataIndex: 'title', key: 'title' },
    { title: '구분', dataIndex: 'origin', render: (value) => labelOf(ORIGIN_OPTIONS, value) },
    { title: '분야', dataIndex: 'categoryId', render: categoryName },
    {
      title: '운동',
      dataIndex: 'exerciseCode',
      render: (value) => labelOf(EXERCISE_OPTIONS, value),
    },
    {
      title: '공개 상태',
      dataIndex: 'publicationStatus',
      render: (value) => <StatusTag kind="missionDefinitionPublicationStatus" value={value} />,
    },
    {
      title: '등록일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: true,
      render: (value) => <DateText value={value} />,
    },
    {
      title: '',
      key: 'actions',
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
          미션 틀
        </Typography.Title>
        <Link to="/missions/definitions/new">
          <Button type="primary">미션 등록</Button>
        </Link>
      </Space>
      <FilterBar fields={fields} value={params} onChange={setParams} />
      <DataTable query={query} columns={columns} defaultSort="createdAt,desc" />
    </div>
  );
}
