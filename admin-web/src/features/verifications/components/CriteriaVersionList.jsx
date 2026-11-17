import { Table, Typography } from 'antd';
import { DateText } from '../../../components/DateText.jsx';
import { METHOD_LABEL } from './format.js';
import { t } from '../../../i18n/index.js';

/**
 * Versions of the verification criteria (ADM-10). Versions are never edited; a change adds a new
 * version, so the list is a history. Each row can be opened to read the `rules` object.
 * @param {{
 *   versions: {id: string, categoryId: string, verificationMethod: string, versionNo: number,
 *     rules: object, effectiveAt?: string|null}[],
 *   categoryName: (categoryId: string) => string,
 * }} props
 */
export default function CriteriaVersionList({ versions, categoryName }) {
  const columns = [
    { title: t('분야'), dataIndex: 'categoryId', render: categoryName },
    {
      title: t('인증 방식'),
      dataIndex: 'verificationMethod',
      render: (value) => METHOD_LABEL[value] ?? value,
    },
    { title: t('버전'), dataIndex: 'versionNo', width: 72 },
    {
      title: t('시행 시각'),
      dataIndex: 'effectiveAt',
      render: (value) => <DateText value={value} />,
    },
  ];

  return (
    <Table
      rowKey="id"
      size="small"
      columns={columns}
      dataSource={versions}
      pagination={false}
      expandable={{
        expandedRowRender: (version) => (
          <Typography.Text code style={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(version.rules, null, 2)}
          </Typography.Text>
        ),
      }}
    />
  );
}
