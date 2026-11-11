# components/ — shared components of the admin web

Owner: Freud (AW-04). Spec: `docs/parts/admin-web.md` §6, rules §7. Import each component from its
own file: `import { DataTable } from '../../../components/DataTable.jsx';`

`AdminLayout` (the table in §6 lists it) is in `src/app/AdminLayout.jsx` (AW-03).
`StatusTag` needs `src/constants/labels.js` (AW-05).

## A list screen (QueryBoundary · FilterBar · DataTable · useListParams)

```jsx
// features/verifications/pages/VerificationQueuePage.jsx
// ADM-07 인증 검수 대기 목록
const fields = [
  { name: 'status', type: 'select', label: '상태', options: [{ value: 'open', label: '대기' }] },
  { name: 'period', type: 'dateRange' }, // writes `from` and `to`
];

export default function VerificationQueuePage() {
  const navigate = useNavigate();
  const [params, setParams] = useListParams({ sort: 'createdAt,asc' }); // API default sort (docs/09)
  const query = useVerifications(params); // queries.js: `placeholderData: keepPreviousData`

  return (
    <>
      <FilterBar fields={fields} value={params} onChange={setParams} />
      <DataTable
        query={query}
        defaultSort="createdAt,asc"
        onRowClick={(row) => navigate(`/verifications/${row.recordId}`)}
        columns={[
          {
            title: '요청 시각',
            dataIndex: 'createdAt',
            key: 'createdAt',
            sorter: true,
            render: (value) => <DateText value={value} />,
          },
          {
            title: '상태',
            dataIndex: 'status',
            render: (value) => <StatusTag kind="recordStatus" value={value} />,
          },
        ]}
      />
    </>
  );
}
```

- `DataTable` reads `{items, page, size, totalCount}` (`AdminPage`) from `query.data`.
- Page, size and sort are written to the URL (`?page=2&size=20&sort=createdAt,desc`); a column is
  sortable with `sorter: true` and its `key` (or `dataIndex`) is the sort field.
- `useListParams(defaults)` returns `[params, setParams]`. `params` goes straight to the API
  function. `setParams(patch)` removes a key whose value is `''`, `null` or `undefined`, and goes
  back to page 1 unless `patch` has a `page`.
- `FilterBar` calls `onChange` with every field ('' when empty), so `onChange={setParams}` is enough.
  A `dateRange` field always uses the keys `from` and `to` (docs/05 §3).

## A change (ConfirmActionModal)

```jsx
const [open, setOpen] = useState(false);
const decide = useDecideVerification(); // queries.js: invalidates the menu's queries on success

<ConfirmActionModal
  open={open}
  title="검수 승인"
  summary="기록 3f2c… · 승인"
  onSubmit={async ({ reason, idempotencyKey }) => {
    await decide.mutateAsync({ recordId, body: { decision: 'approved', reason }, idempotencyKey });
    message.success('처리했어요');
    setOpen(false);
  }}
  onCancel={() => setOpen(false)}
/>;
```

- A new Idempotency-Key is made every time the modal opens. If `onSubmit` throws, the modal stays
  open, shows `error.message`, and the next try uses the SAME key (the reason is locked then,
  because the same key needs the same body). Cancel and open again for a new key.
- The reason is required (1~500 characters, whitespace only is not enough) and is sent trimmed.

## States

```jsx
<QueryBoundary query={query}>{(data) => <Detail data={data} />}</QueryBoundary>
<StatePanel type="empty" />   // loading | empty | invalid | saveFailed | forbidden | done | notFound
<StatePanel type="saveFailed" message={error.message} onRetry={refetch} />
<NotImplementedPanel />       // ADM-17, ADM-28~31
```

`QueryBoundary`: loading -> `StatePanel loading`; 403 -> `forbidden`; other error -> `saveFailed`
with `error.message` and a "다시 시도" button that calls `query.refetch()`.

## Small ones

```jsx
<DateText value={row.createdAt} />              // 2026-11-04T02:15:00.000Z -> 2026-11-04 11:15
<DateText value={row.scheduledDate} />          // a `date` is shown as it is: 2026-11-04
<MaskedText value={row.phoneMasked} />          // the server's masked value, never unmasked
<StatusTag kind="missionStatus" value="completed" />
<JsonEditor value={text} onChange={(text, parsed) => setText(text)} error={serverError} />
<ImageUploadField assetKind="badge" ownerId={achievementId} value={assetId} onChange={setAssetId} />
```

- `JsonEditor`'s value is the text; `parsed` (2nd argument) is `undefined` while the text is empty
  or not valid JSON.
- `ImageUploadField` runs M84 -> PUT -> M85 after the confirm modal (PNG/WebP/JPEG, at most 2MB).

## Extras that are not in the table of §6

Small additions to the props of the table: `StatePanel` `message`, `FilterBar` field `label`,
`DataTable` `defaultSort`. Text strings that the docs do not give (loading, empty, "검색",
"초기화", "총 N건", the image messages) are UI texts of this folder only.
