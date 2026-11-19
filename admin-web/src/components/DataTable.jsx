import { useEffect, useRef, useState } from 'react';
import { Table } from 'antd';
import { QueryBoundary } from './QueryBoundary.jsx';
import { StatePanel } from './StatePanel.jsx';
import { useListParams } from './useListParams.js';
import { t } from '../i18n/index.js';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]; // docs/05 §6: size is at most 100

// Name sent in `sort=field,asc|desc`: the column `key`, or else its `dataIndex`.
const sortFieldOf = (column) =>
  column?.key ??
  (Array.isArray(column?.dataIndex) ? column.dataIndex.join('.') : column?.dataIndex);

const parseSort = (sort) => {
  if (!sort) return null;
  const [field, direction = 'asc'] = sort.split(',');
  return { field, order: direction === 'desc' ? 'descend' : 'ascend' };
};

/**
 * antd `Table` with server-side paging and sorting. The page, size and sort live in the URL query
 * (`useListParams`), so a reload or a shared link shows the same list. Filters are written by the
 * page (for example with `FilterBar`) through the same hook.
 *
 * The list comes from `query` (a `useQuery` result whose data is an `AdminPage`:
 * `{items, page, size, totalCount}`, docs/07 §1). Loading, 403 and other errors are shown with
 * `QueryBoundary`; an empty list shows `StatePanel empty`.
 *
 * To make a column sortable give it `sorter: true`; its `key` (or `dataIndex`) is the sort field.
 *
 * @param {object} props
 * @param {import('antd').TableColumnsType} props.columns
 * @param {import('@tanstack/react-query').UseQueryResult} props.query
 * @param {string} [props.rowKey] default 'id'
 * @param {(record: any) => void} [props.onRowClick]
 * @param {string} [props.defaultSort] e.g. 'recordedAt,desc': the default sort of the API, only
 *   used to show the sort arrow while the URL has no `sort`
 */
export function DataTable({ columns, query, rowKey = 'id', onRowClick, defaultSort }) {
  const [params, setParams] = useListParams();
  const currentSort = parseSort(params.sort ?? defaultSort);
  const wrapperRef = useRef(null);
  const [moreRight, setMoreRight] = useState(false);

  // Show a shadow on the right edge while columns are still hidden to the right.
  useEffect(() => {
    const root = wrapperRef.current;
    if (!root) return undefined;
    let scroller = null;
    const update = () => {
      if (scroller)
        setMoreRight(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2);
    };
    const attach = () => {
      const next = root.querySelector('.ant-table-content, .ant-table-body');
      if (next === scroller) return update();
      scroller?.removeEventListener('scroll', update);
      scroller = next;
      scroller?.addEventListener('scroll', update, { passive: true });
      return update();
    };
    attach();
    // data, page size or window width changes can change whether the table overflows
    const observer = new MutationObserver(attach);
    observer.observe(root, { childList: true, subtree: true });
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      scroller?.removeEventListener('scroll', update);
    };
    // the table only exists once the query has data, so attach again when it arrives
  }, [query.isSuccess]);

  // The first column (who / when) stays in view while the rest scrolls sideways.
  const tableColumns = columns.map((column, index) => {
    const withSort = column.sorter
      ? {
          ...column,
          sortOrder: currentSort?.field === sortFieldOf(column) ? currentSort.order : null,
        }
      : column;
    return index === 0 && withSort.fixed === undefined ? { ...withSort, fixed: 'left' } : withSort;
  });

  const handleChange = (pagination, _filters, sorter, extra) => {
    if (extra.action === 'sort') {
      const { column, order } = Array.isArray(sorter) ? (sorter[0] ?? {}) : sorter;
      const field = order ? sortFieldOf(column) : undefined;
      setParams({ sort: field ? `${field},${order === 'ascend' ? 'asc' : 'desc'}` : undefined });
      return;
    }
    // Anything else is a page change. It is decided by the values (not by `extra.action`):
    // only a different page or size is written to the URL.
    const { page, size } = query.data ?? {};
    if (pagination.current === page && pagination.pageSize === size) return;
    const sizeChanged = pagination.pageSize !== size;
    setParams({ page: sizeChanged ? 1 : pagination.current, size: pagination.pageSize });
  };

  return (
    <QueryBoundary query={query}>
      {(data) => (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
          <Table
            columns={tableColumns}
            dataSource={data.items}
            rowKey={rowKey}
            // On a narrow screen scroll sideways instead of squeezing text into one character per line
            scroll={{ x: 'max-content' }}
            // header row stays visible under the (sticky) top bar while the page scrolls
            sticky={{ offsetHeader: 64 }}
            loading={query.isFetching}
            locale={{ emptyText: <StatePanel type="empty" /> }}
            pagination={{
              current: data.page,
              pageSize: data.size,
              total: data.totalCount,
              showSizeChanger: true,
              pageSizeOptions: PAGE_SIZE_OPTIONS,
              showTotal: (total) => t('총 {0}건', total),
            }}
            onChange={handleChange}
            onRow={
              onRowClick
                ? (record) => ({ onClick: () => onRowClick(record), style: { cursor: 'pointer' } })
                : undefined
            }
          />
          {moreRight && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 56, // keeps the pagination row clear
                width: 28,
                pointerEvents: 'none',
                background: 'linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.14))',
              }}
            />
          )}
        </div>
      )}
    </QueryBoundary>
  );
}
