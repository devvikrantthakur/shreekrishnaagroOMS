import React, { useState, useEffect, useCallback } from 'react';
import { FileDown, Plus, XCircle, Search } from 'lucide-react';
import api, { downloadFileWithAuth, getErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import StatusBadge from '../../components/common/StatusBadge';
import Pagination from '../../components/common/Pagination';
import { LoadingSpinner, EmptyState } from '../../components/common/Feedback';
import Modal from '../../components/common/Modal';

export default function InvoicesPage() {
  const toast = useToast();
  const [invoices, setInvoices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [genModal, setGenModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelStatus, setCancelStatus] = useState('CANCELLED');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, ordRes] = await Promise.all([
        api.get('/admin/invoices', { params: { page, limit: 15, search: search || undefined } }),
        api.get('/admin/orders', { params: { limit: 100 } }),
      ]);
      setInvoices(invRes.data.data.items || []);
      setPagination(invRes.data.data.pagination);
      setOrders((ordRes.data.data.items || []).filter((o) => o.status !== 'CANCELLED'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/admin/invoices/order/${selectedOrderId}`, {});
      toast.success(`Invoice ${res.data.data.invoice.invoice_number} generated.`);
      setGenModal(false);
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleCancelInvoice = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/admin/invoices/${cancelTarget.id}/cancel`, {
        status: cancelStatus,
        reason: cancelReason,
      });
      toast.success(`Invoice marked as ${cancelStatus}.`);
      setCancelTarget(null);
      setCancelReason('');
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoice Management</h1>
          <p className="text-sm text-slate-500">Issue unique PDF invoices, track balances & credit notes</p>
        </div>
        <button
          onClick={() => {
            setSelectedOrderId(orders[0] ? String(orders[0].id) : '');
            setGenModal(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-agro-600 hover:bg-agro-700 text-white text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Issue Invoice
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search invoice #, order #, customer..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading invoices..." />
      ) : invoices.length === 0 ? (
        <EmptyState title="No invoices issued yet" />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 font-semibold">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-agro-700 font-medium">{inv.order_number}</td>
                    <td className="px-4 py-3">{inv.customer_name}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(inv.invoice_date)}</td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(inv.total_amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1.5">
                        <button
                          onClick={() =>
                            downloadFileWithAuth(
                              `/admin/invoices/${inv.id}/pdf`,
                              `Invoice-${inv.invoice_number}.pdf`
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-agro-50 text-agro-700 hover:bg-agro-100 text-xs font-semibold"
                        >
                          <FileDown className="w-3.5 h-3.5" /> PDF
                        </button>
                        {inv.status === 'ISSUED' && (
                          <button
                            onClick={() => setCancelTarget(inv)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Cancel
                          </button>
                        )}
                      </div>
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

      <Modal open={genModal} onClose={() => setGenModal(false)} title="Issue New Invoice">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Select Order</label>
            <select
              required
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            >
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.order_number} — {o.customer_name} ({formatCurrency(o.total_amount)})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setGenModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-sm">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-agro-600 text-white text-sm font-semibold">
              Issue Invoice
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} title={`Cancel / Credit Note — ${cancelTarget?.invoice_number || ''}`}>
        <form onSubmit={handleCancelInvoice} className="space-y-3">
          <select
            value={cancelStatus}
            onChange={(e) => setCancelStatus(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
          >
            <option value="CANCELLED">CANCELLED</option>
            <option value="CREDIT_NOTE">CREDIT_NOTE</option>
          </select>
          <input
            type="text"
            required
            placeholder="Reason *"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCancelTarget(null)} className="px-4 py-2 rounded-xl bg-slate-100 text-sm">
              Back
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold">
              Confirm
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
