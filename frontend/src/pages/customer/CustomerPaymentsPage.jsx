import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import StatusBadge from '../../components/common/StatusBadge';
import Pagination from '../../components/common/Pagination';
import { LoadingSpinner, EmptyState } from '../../components/common/Feedback';

export default function CustomerPaymentsPage() {
  const toast = useToast();
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/payments', { params: { page, limit: 15 } });
      setPayments(res.data.data.items || []);
      setPagination(res.data.data.pagination);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Payment History</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">All payments & refunds recorded against your orders</p>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading payment history..." />
      ) : payments.length === 0 ? (
        <EmptyState title="No payments found" description="Payments made on your orders will appear here." />
      ) : (
        <div className="space-y-3">
          {/* Mobile Payment Cards */}
          <div className="sm:hidden space-y-3">
            {payments.map((p) => (
              <div
                key={p.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white text-sm truncate">{p.payment_number}</div>
                    <Link
                      to={`/orders/${p.order_id}`}
                      className="text-xs text-agro-700 dark:text-agro-400 font-semibold hover:underline"
                    >
                      Order: {p.order_number}
                    </Link>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="text-slate-500 dark:text-slate-400">
                    {p.payment_method} • {formatDateTime(p.payment_date)}
                    {p.transaction_ref ? ` • Ref: ${p.transaction_ref}` : ''}
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white text-sm shrink-0">
                    {formatCurrency(p.amount)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs uppercase text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Payment #</th>
                    <th className="px-4 py-3">Order #</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{p.payment_number}</td>
                      <td className="px-4 py-3">
                        <Link to={`/orders/${p.order_id}`} className="text-agro-700 dark:text-agro-400 font-medium hover:underline">
                          {p.order_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDateTime(p.payment_date)}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{p.payment_method}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{p.transaction_ref || '-'}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                        {formatCurrency(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 pb-4">
            <Pagination pagination={pagination} onPageChange={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}
