import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CreditCard } from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import StatusBadge from '../../components/common/StatusBadge';
import { LoadingSpinner } from '../../components/common/Feedback';
import Modal from '../../components/common/Modal';

export default function SupplierDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);

  const [payModal, setPayModal] = useState(false);
  const [payForm, setPayForm] = useState({
    purchaseOrderId: '',
    amount: '',
    paymentMethod: 'BANK_TRANSFER',
    transactionRef: '',
    remarks: '',
  });

  const loadSupplier = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/suppliers/${id}`);
      setSupplier(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    loadSupplier();
  }, [loadSupplier]);

  const handlePaySupplier = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/supplier-payments', {
        supplierId: supplier.id,
        purchaseOrderId: payForm.purchaseOrderId || null,
        amount: Number(payForm.amount),
        paymentMethod: payForm.paymentMethod,
        transactionRef: payForm.transactionRef || null,
        remarks: payForm.remarks || null,
      });
      toast.success('Supplier payment recorded.');
      setPayModal(false);
      setPayForm({ purchaseOrderId: '', amount: '', paymentMethod: 'BANK_TRANSFER', transactionRef: '', remarks: '' });
      await loadSupplier();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading || !supplier) return <LoadingSpinner label="Loading supplier ledger..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin/suppliers" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white mb-1">
            <ArrowLeft className="w-4 h-4" /> Back to Suppliers
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{supplier.supplier_name}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Contact: {supplier.contact_person || '-'} • {supplier.mobile} • {supplier.address || '-'}
          </p>
        </div>
        <button
          onClick={() => setPayModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-agro-600 hover:bg-agro-700 text-white text-sm font-semibold"
        >
          <CreditCard className="w-4 h-4" /> Record Supplier Payment
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 uppercase">Opening Balance</div>
          <div className="text-xl font-bold mt-1">{formatCurrency(supplier.opening_balance)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 uppercase">Received Purchases</div>
          <div className="text-xl font-bold mt-1">{formatCurrency(supplier.total_purchased_received)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 uppercase">Total Paid</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">{formatCurrency(supplier.total_paid)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-red-200 p-4">
          <div className="text-xs text-red-600 uppercase">Outstanding Payable</div>
          <div className="text-xl font-bold text-red-700 mt-1">{formatCurrency(supplier.outstanding_payable)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 font-bold">Purchase Orders</div>
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5">PO #</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {supplier.purchases.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2.5 font-semibold">{p.purchase_number}</td>
                  <td className="px-4 py-2.5 text-slate-500">{formatDate(p.purchase_date)}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(p.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 font-bold">Supplier Payments</div>
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Payment #</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Method</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {supplier.payments.map((sp) => (
                <tr key={sp.id}>
                  <td className="px-4 py-2.5 font-semibold">{sp.payment_number}</td>
                  <td className="px-4 py-2.5 text-slate-500">{formatDateTime(sp.payment_date)}</td>
                  <td className="px-4 py-2.5">{sp.payment_method}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{formatCurrency(sp.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={payModal} onClose={() => setPayModal(false)} title="Record Supplier Payment">
        <form onSubmit={handlePaySupplier} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Link to PO (Optional)</label>
            <select
              value={payForm.purchaseOrderId}
              onChange={(e) => setPayForm({ ...payForm, purchaseOrderId: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            >
              <option value="">General Account Payment</option>
              {supplier.purchases
                .filter((p) => p.status !== 'CANCELLED')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.purchase_number} ({formatCurrency(p.total_amount)})
                  </option>
                ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (Rs.) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Method</label>
              <select
                value={payForm.paymentMethod}
                onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              >
                <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                <option value="UPI">UPI</option>
                <option value="CASH">CASH</option>
              </select>
            </div>
          </div>
          <input
            type="text"
            placeholder="Transaction Ref / UTR"
            value={payForm.transactionRef}
            onChange={(e) => setPayForm({ ...payForm, transactionRef: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
          <input
            type="text"
            placeholder="Remarks"
            value={payForm.remarks}
            onChange={(e) => setPayForm({ ...payForm, remarks: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setPayModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700 text-sm font-medium transition">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-agro-600 text-white text-sm font-semibold">
              Record Payment
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
