import React, { useState, useEffect, useCallback } from 'react';
import api, { getErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatDateTime } from '../../utils/formatters';
import Pagination from '../../components/common/Pagination';
import { LoadingSpinner } from '../../components/common/Feedback';

export default function AuditLogsPage() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/audit-logs', {
        params: { page, limit: 25, entity: entity || undefined },
      });
      setLogs(res.data.data.items || []);
      setPagination(res.data.data.pagination);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, entity, toast]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Security & Audit Logs</h1>
          <p className="text-sm text-slate-500">Immutable trail of administrative actions and financial entries</p>
        </div>
        <select
          value={entity}
          onChange={(e) => {
            setEntity(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm"
        >
          <option value="">All Entities</option>
          <option value="users">users</option>
          <option value="vegetables">vegetables</option>
          <option value="customer_orders">customer_orders</option>
          <option value="purchase_orders">purchase_orders</option>
          <option value="stock_movements">stock_movements</option>
          <option value="deliveries">deliveries</option>
          <option value="payments">payments</option>
          <option value="invoices">invoices</option>
          <option value="expenses">expenses</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading audit logs..." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-900">{l.actor_name || 'System'}</span>
                      <span className="block text-[10px] text-slate-400">{l.actor_role}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-agro-700">{l.action}</td>
                    <td className="px-4 py-3">
                      {l.entity} {l.entity_id ? `#${l.entity_id}` : ''}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600 max-w-md truncate">
                      {l.details ? (typeof l.details === 'string' ? l.details : JSON.stringify(l.details)) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <Pagination pagination={pagination} onPageChange={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}
