import LoadingSpinner from './LoadingSpinner.jsx';
import EmptyState from './EmptyState.jsx';

export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  emptyTitle = 'No data available',
  emptyDescription = 'There are no records to display.',
  emptyAction,
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white">
        <LoadingSpinner text="Fetching data..." />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-600">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key || col.header}
                  className={`px-4 py-3 font-semibold ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row, idx) => (
              <tr key={row._id || row.id || idx} className="hover:bg-slate-50/60 transition-colors">
                {columns.map((col) => (
                  <td
                    key={col.key || col.header}
                    className={`px-4 py-3 text-slate-700 ${col.className || ''}`}
                  >
                    {col.render ? col.render(row, idx) : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
