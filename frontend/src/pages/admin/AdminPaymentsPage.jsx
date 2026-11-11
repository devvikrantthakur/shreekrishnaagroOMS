import React, { useState, useEffect, useCallback } from 'react';
import { Plus, RotateCcw, Search } from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import StatusBadge from '../../components/common/StatusBadge';
import Pagination from '../../components/common/Pagination';
import { LoadingSpinner, EmptyState } from '../../components/common/Feedback';
import Modal from '../../components/common/Modal';

export default function AdminPaymentsPage() {
  const toast = useToast();
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('');
  const [page, setPage] = useState(1);

  const [payModal, setPayModal] = useState(false);
  const [payForm, setPayForm] = useState({
    orderId: '',
    amount: '',
    paymentMethod: 'CASH',
    transactionRef: '',
    remarks: '',
  });

  const [refundTarget, setRefundTarget] = useState(null);
  const [refundForm, setRefundForm] = useState({
    amount: '',
    refundMethod: 'UPI',
    transactionRef: '',
    reason: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [payRes, ordRes] = await Promise.all([
        api.get('/admin/payments', {
          params: { page, limit: 15, search: search || undefined, method: method || undefined },
        }),
        api.get('/admin/orders', { params: { limit: 100 } }),
      ]);
      setPayments(payRes.data.data.items || []);
      setPagination(payRes.data.data.pagination);
      setOrders((ordRes.data.data.items || []).filter((o) => Number(o.balance_due) > 0));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, method, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/payments', {
        orderId: payForm.orderId,
        amount: Number(payForm.amount),
        paymentMethod: payForm.paymentMethod,
        transactionRef: payForm.transactionRef || null,
        remarks: payForm.remarks || null,
      });
      toast.success('Customer payment recorded.');
      setPayModal(false);
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleIssueRefund = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/payments/refunds', {
        paymentId: refundTarget.id,
        amount: Number(refundForm.amount),
        refundMethod: refundForm.refundMethod,
        transactionRef: refundForm.transactionRef || null,
        reason: refundForm.reason,
      });
      toast.success('Refund issued and recorded.');
      setRefundTarget(null);
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment Management</h1>
          <p className="text-sm text-slate-500">Record customer receipts, partial payments & refunds</p>
        </div>
        <button
          onClick={() => {
            const first = orders[0];
            setPayForm({
              orderId: first ? String(first.id) : '',
              amount: first ? String(first.balance_due) : '',
              paymentMethod: 'CASH',
              transactionRef: '',
              remarks: '',
            });
            setPayModal(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-agro-600 hover:bg-agro-700 text-white text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Record Payment
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search payment #, order #, customer, ref..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
        </div>
        <select
          value={method}
          onChange={(e) => {
            setMethod(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
        >
          <option value="">All Methods</option>
          <option value="CASH">CASH</option>
          <option value="UPI">UPI</option>
          <option value="BANK_TRANSFER">BANK_TRANSFER</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading payments..." />
      ) : payments.length === 0 ? (
        <EmptyState title="No payments recorded yet" />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Payment #</th>
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Refunded</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-semibold">{p.payment_number}</td>
                    <td className="px-4 py-3 text-agro-700 font-medium">{p.order_number}</td>
                    <td className="px-4 py-3">{p.customer_name}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(p.payment_date)}</td>
                    <td className="px-4 py-3">{p.payment_method}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 text-right text-red-600">
                      {formatCurrency(p.refunded_amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.status === 'SUCCESS' && Number(p.amount) > Number(p.refunded_amount) && (
                        <button
                          onClick={() => {
                            setRefundTarget(p);
                            setRefundForm({
                              amount: String(Number(p.amount) - Number(p.refunded_amount)),
                              refundMethod: p.payment_method,
                              transactionRef: '',
                              reason: '',
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Refund
                        </button>
                      )}
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

      <Modal open={payModal} onClose={() => setPayModal(false)} title="Record Customer Payment">
        <form onSubmit={handleRecordPayment} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Order *</label>
            <select
              required
              value={payForm.orderId}
              onChange={(e) => {
                const ord = orders.find((o) => String(o.id) === e.target.value);
                setPayForm({
                  ...payForm,
                  orderId: e.target.value,
                  amount: ord ? String(ord.balance_due) : '',
                });
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            >
              <option value="">Select Unpaid/Partial Order</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.order_number} — {o.customer_name} (Due: {formatCurrency(o.balance_due)})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="Amount"
              value={payForm.amount}
              onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
            <select
              value={payForm.paymentMethod}
              onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            >
              <option value="CASH">CASH</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">BANK_TRANSFER</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="Transaction Reference"
            value={payForm.transactionRef}
            onChange={(e) => setPayForm({ ...payForm, transactionRef: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setPayModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-sm">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-agro-600 text-white text-sm font-semibold">
              Save Payment
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(refundTarget)} onClose={() => setRefundTarget(null)} title={`Issue Refund — ${refundTarget?.payment_number || ''}`}>
        <form onSubmit={handleIssueRefund} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="Refund Amount"
              value={refundForm.amount}
              onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
            <select
              value={refundForm.refundMethod}
              onChange={(e) => setRefundForm({ ...refundForm, refundMethod: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            >
              <option value="CASH">CASH</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">BANK_TRANSFER</option>
            </select>
          </div>
          <input
            type="text"
            required
            placeholder="Refund Reason *"
            value={refundForm.reason}
            onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setRefundTarget(null)} className="px-4 py-2 rounded-xl bg-slate-100 text-sm">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold">
              Issue Refund
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
