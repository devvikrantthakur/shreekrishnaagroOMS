import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Package, Eye } from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import StatusBadge from '../../components/common/StatusBadge';
import Pagination from '../../components/common/Pagination';
import { LoadingSpinner, EmptyState } from '../../components/common/Feedback';

export default function CustomerOrdersPage() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders', {
        params: { page, limit: 15, status: status || undefined },
      });
      setOrders(res.data.data.items || []);
      setPagination(res.data.data.pagination);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, status, toast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Orders</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track delivery progress, payments and invoices</p>
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm font-medium"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PROCESSING">Processing</option>
          <option value="PARTIALLY_DELIVERED">Partially Delivered</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading your orders..." />
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Place your first fresh vegetable order from our store."
          action={
            <Link
              to="/"
              className="px-4 py-2 rounded-xl bg-agro-600 text-white text-sm font-semibold"
            >
              Shop Fresh Vegetables
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {/* Mobile Order Cards */}
          <div className="sm:hidden space-y-3">
            {orders.map((ord) => (
              <div
                key={ord.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-sm">
                      <Package className="w-4 h-4 text-agro-600 shrink-0" />
                      <span className="truncate">{ord.order_number}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {formatDateTime(ord.created_at)} • {ord.item_count} items
                    </div>
                  </div>
                  <StatusBadge status={ord.status} />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    <div className="text-slate-400">Total</div>
                    <div className="font-bold text-slate-900 dark:text-white">{formatCurrency(ord.total_amount)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Paid</div>
                    <div className="font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(ord.net_paid)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Due</div>
                    <div className="font-bold text-red-600 dark:text-red-400">{formatCurrency(ord.balance_due)}</div>
                  </div>
                </div>

                <Link
                  to={`/orders/${ord.id}`}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-agro-50 dark:bg-slate-800 text-agro-700 dark:text-white hover:bg-agro-100 dark:hover:bg-slate-700 text-xs font-bold"
                >
                  <Eye className="w-3.5 h-3.5" /> View Order Details
                </Link>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs uppercase text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Order #</th>
                    <th className="px-4 py-3">Placed On</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Balance Due</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        <span className="inline-flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-agro-600" />
                          {ord.order_number}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDateTime(ord.created_at)}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{ord.item_count} items</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={ord.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(ord.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400 font-medium">
                        {formatCurrency(ord.net_paid)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600 dark:text-red-400">
                        {formatCurrency(ord.balance_due)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/orders/${ord.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-agro-50 dark:bg-slate-800 text-agro-700 dark:text-white hover:bg-agro-100 dark:hover:bg-slate-700 text-xs font-semibold"
                        >
                          <Eye className="w-3.5 h-3.5" /> Details
                        </Link>
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
