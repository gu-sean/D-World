import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { DataTable } from './DataTable.jsx';
import { useListParams } from './useListParams.js';

const columns = [
  { title: '이름', dataIndex: 'name', key: 'name', sorter: true },
  { title: '상태', dataIndex: 'status', key: 'status' },
];

// A `useQuery` result with the fields that DataTable and QueryBoundary read.
const makeQuery = (overrides = {}) => ({
  data: {
    items: [
      { id: '1', name: 'Alpha', status: 'a' },
      { id: '2', name: 'Beta', status: 'b' },
    ],
    page: 1,
    size: 20,
    totalCount: 45,
  },
  isPending: false,
  isError: false,
  isFetching: false,
  error: null,
  refetch: vi.fn(),
  ...overrides,
});

// Shows the URL query so that tests can read what the components wrote.
function LocationProbe() {
  const { search } = useLocation();
  return <div data-testid="search">{search}</div>;
}

const renderAt = (ui, url = '/list') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      {ui}
      <LocationProbe />
    </MemoryRouter>,
  );

const urlParams = () => new URLSearchParams(screen.getByTestId('search').textContent);

describe('DataTable', () => {
  test('draws the rows and the total of the query result', () => {
    renderAt(<DataTable columns={columns} query={makeQuery()} />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('총 45건')).toBeInTheDocument();
  });

  test('URL sync: going to page 2 writes page and size to the URL query', async () => {
    const user = userEvent.setup();
    renderAt(<DataTable columns={columns} query={makeQuery()} />);

    // antd 6 puts the click handler on the <a role="button"> inside the page <li>.
    await user.click(screen.getByRole('button', { name: 'Page 2' }));

    await waitFor(() => expect(urlParams().get('page')).toBe('2'));
    expect(urlParams().get('size')).toBe('20');
  });

  test('URL sync: clicking a sortable header writes sort, and again flips it', async () => {
    const user = userEvent.setup();
    renderAt(<DataTable columns={columns} query={makeQuery()} />);

    await user.click(screen.getByText('이름'));
    expect(urlParams().get('sort')).toBe('name,asc');

    await user.click(screen.getByText('이름'));
    expect(urlParams().get('sort')).toBe('name,desc');
  });

  test('URL sync: changing the sort goes back to page 1', async () => {
    const user = userEvent.setup();
    renderAt(<DataTable columns={columns} query={makeQuery()} />, '/list?page=3&size=20');

    await user.click(screen.getByText('이름'));

    expect(urlParams().get('sort')).toBe('name,asc');
    expect(urlParams().get('page')).toBeNull();
  });

  test('calls onRowClick with the record of the clicked row', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    renderAt(<DataTable columns={columns} query={makeQuery()} onRowClick={onRowClick} />);

    await user.click(screen.getByText('Alpha'));

    expect(onRowClick).toHaveBeenCalledWith({ id: '1', name: 'Alpha', status: 'a' });
  });

  test('shows the empty state for an empty list', () => {
    const query = makeQuery({ data: { items: [], page: 1, size: 20, totalCount: 0 } });
    renderAt(<DataTable columns={columns} query={query} />);

    expect(screen.getByText('결과가 없어요.')).toBeInTheDocument();
  });

  test('shows the loading state before the first data', () => {
    renderAt(
      <DataTable columns={columns} query={makeQuery({ data: undefined, isPending: true })} />,
    );

    expect(screen.getByText('불러오는 중이에요.')).toBeInTheDocument();
  });

  test('shows the forbidden state for a 403', () => {
    const query = makeQuery({
      data: undefined,
      isError: true,
      error: { status: 403, code: 'COMMON_FORBIDDEN', message: '권한이 없어요.' },
    });
    renderAt(<DataTable columns={columns} query={query} />);

    expect(screen.getByText('권한이 없어요.')).toBeInTheDocument();
  });

  test('shows error.message with a retry button that refetches', async () => {
    const user = userEvent.setup();
    const query = makeQuery({
      data: undefined,
      isError: true,
      error: { status: 500, code: 'COMMON_INTERNAL', message: '서버 문구 그대로' },
    });
    renderAt(<DataTable columns={columns} query={query} />);

    expect(screen.getByText('서버 문구 그대로')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(query.refetch).toHaveBeenCalledTimes(1);
  });
});

describe('useListParams', () => {
  function ParamsProbe() {
    const [params, setParams] = useListParams({ sort: 'recordedAt,desc' });
    return (
      <div>
        <div data-testid="params">{JSON.stringify(params)}</div>
        <button onClick={() => setParams({ status: 'a' })}>filter</button>
        <button onClick={() => setParams({ status: '' })}>clear</button>
      </div>
    );
  }
  const readParams = () => JSON.parse(screen.getByTestId('params').textContent);

  test('uses page 1, size 20 and the given defaults when the URL has nothing', () => {
    renderAt(<ParamsProbe />);

    expect(readParams()).toEqual({ page: 1, size: 20, sort: 'recordedAt,desc' });
  });

  test('reads numbers for page and size and strings for the rest', () => {
    renderAt(<ParamsProbe />, '/list?page=3&size=50&status=a,b&sort=name,asc');

    expect(readParams()).toEqual({ page: 3, size: 50, status: 'a,b', sort: 'name,asc' });
  });

  test('falls back for a wrong page and caps size at 100', () => {
    renderAt(<ParamsProbe />, '/list?page=abc&size=1000');

    expect(readParams()).toMatchObject({ page: 1, size: 100 });
  });

  test('a filter change keeps the size, drops the page, and an empty value removes the key', async () => {
    const user = userEvent.setup();
    renderAt(<ParamsProbe />, '/list?page=3&size=50');

    await user.click(screen.getByText('filter'));
    expect(urlParams().get('status')).toBe('a');
    expect(urlParams().get('size')).toBe('50');
    expect(urlParams().get('page')).toBeNull();

    await user.click(screen.getByText('clear'));
    expect(urlParams().get('status')).toBeNull();
  });
});
