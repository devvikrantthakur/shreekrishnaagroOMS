import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Boxes,
  Edit3,
  FileText,
  FileDown,
  CreditCard,
  Plus,
  Trash2,
} from 'lucide-react';
import api, { downloadFileWithAuth, getErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDateTime, formatQty } from '../../utils/formatters';
import StatusBadge from '../../components/common/StatusBadge';
import { LoadingSpinner } from '../../components/common/Feedback';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';

export default function AdminOrderDetailPage() {
  const { id } = useParams();
  const toast = useToast();

  const [order, setOrder] = useState(null);
  const [vegetables, setVegetables] = useState([]);
  const [loading, setLoading] = useState(true);

  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);

  // Edit items modal
  const [editModal, setEditModal] = useState(false);
  const [editItems, setEditItems] = useState([]);
  const [editDiscount, setEditDiscount] = useState(0);

  // Payment modal
  const [payModal, setPayModal] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: '',
    paymentMethod: 'CASH',
    transactionRef: '',
    remarks: '',
  });

  const loadOrder = useCallback(async () => {
    setLoading(true);
    try {
      const [ordRes, vegRes] = await Promise.all([
        api.get(`/admin/orders/${id}`),
        api.get('/admin/vegetables', { params: { limit: 200, status: 'ACTIVE' } }),
      ]);
      const data = ordRes.data.data;
      setOrder(data);
      setVegetables(vegRes.data.data.items || []);
      setPayForm((f) => ({
        ...f,
        amount: data.paymentSummary?.balanceDue > 0 ? String(data.paymentSummary.balanceDue) : '',
      }));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handleStatusChange = async (status, reason = null) => {
    setBusy(true);
    try {
      await api.patch(`/admin/orders/${id}/status`, { status, reason });
      toast.success(`Order status updated to ${status}`);
      setCancelConfirm(false);
      await loadOrder();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleAllocateStock = async () => {
    setBusy(true);
    try {
      await api.post(`/admin/orders/${id}/allocate`);
      toast.success('Available stock allocated to order items.');
      await loadOrder();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateInvoice = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/admin/invoices/order/${id}`, {});
      toast.success(`Invoice ${res.data.data.invoice.invoice_number} issued!`);
      await loadOrder();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const openEditModal = () => {
    setEditItems(
      order.items.map((oi) => ({
        vegetableId: String(oi.vegetable_id),
        quantity: Number(oi.quantity),
        unit: oi.unit,
      }))
    );
    setEditDiscount(Number(order.discount_amount || 0));
    setEditModal(true);
  };

  const handleSaveEditedItems = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put(`/admin/orders/${id}/items`, {
        items: editItems.map((i) => ({
          vegetableId: i.vegetableId,
          quantity: Number(i.quantity),
          unit: i.unit,
        })),
        discountAmount: Number(editDiscount || 0),
      });
      toast.success('Order items updated and totals recalculated.');
      setEditModal(false);
      await loadOrder();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/admin/payments', {
        orderId: order.id,
        amount: Number(payForm.amount),
        paymentMethod: payForm.paymentMethod,
        transactionRef: payForm.transactionRef || null,
        remarks: payForm.remarks || null,
      });
      toast.success('Payment recorded.');
      setPayModal(false);
      await loadOrder();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading || !order) return <LoadingSpinner label="Loading order details..." />;

  const addr = order.delivery_address_snapshot || {};
  const ps = order.paymentSummary || {};
  const activeInvoice = (order.invoices || []).find((i) => i.status === 'ISSUED');
  const canEditItems =
    ['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status) && order.deliveries.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/admin/orders"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-1"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Orders
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{order.order_number}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Customer: <strong>{order.customer_name}</strong> ({order.customer_mobile}) •{' '}
            {formatDateTime(order.created_at)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {order.status === 'PENDING' && (
            <button
              disabled={busy}
              onClick={() => handleStatusChange('CONFIRMED')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold"
            >
              <CheckCircle2 className="w-4 h-4" /> Confirm Order
            </button>
          )}
          {['PENDING', 'CONFIRMED'].includes(order.status) && (
            <button
              disabled={busy}
              onClick={() => handleStatusChange('PROCESSING')}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
            >
              Mark Processing
            </button>
          )}
          {['CONFIRMED', 'PROCESSING', 'PARTIALLY_DELIVERED'].includes(order.status) && (
            <button
              disabled={busy}
              onClick={handleAllocateStock}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-agro-600 hover:bg-agro-700 text-white text-xs font-semibold"
            >
              <Boxes className="w-4 h-4" /> Allocate Stock
            </button>
          )}
          {canEditItems && (
            <button
              disabled={busy}
              onClick={openEditModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold"
            >
              <Edit3 className="w-4 h-4" /> Edit Items
            </button>
          )}
          {order.status !== 'CANCELLED' && !activeInvoice && (
            <button
              disabled={busy}
              onClick={handleGenerateInvoice}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              <FileText className="w-4 h-4" /> Issue Invoice
            </button>
          )}
          {activeInvoice && (
            <button
              onClick={() =>
                downloadFileWithAuth(
                  `/admin/invoices/${activeInvoice.id}/pdf`,
                  `Invoice-${activeInvoice.invoice_number}.pdf`
                )
              }
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold"
            >
              <FileDown className="w-4 h-4" /> PDF ({activeInvoice.invoice_number})
            </button>
          )}
          {order.status !== 'CANCELLED' && ps.balanceDue > 0 && (
            <button
              onClick={() => setPayModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              <CreditCard className="w-4 h-4" /> Add Payment
            </button>
          )}
          {['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status) && (
            <button
              disabled={busy}
              onClick={() => setCancelConfirm(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold"
            >
              <XCircle className="w-4 h-4" /> Cancel Order
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 font-bold text-slate-900">
            Order Items & Allocation Status
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Vegetable</th>
                  <th className="px-4 py-3 text-right">Ordered</th>
                  <th className="px-4 py-3 text-right">Delivered</th>
                  <th className="px-4 py-3 text-right">Allocated</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((oi) => (
                  <tr key={oi.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {oi.vegetable_name_snapshot}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatQty(oi.quantity, oi.unit)}
                      <span className="block text-[11px] text-slate-400">
                        {formatQty(oi.base_quantity, oi.base_unit)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-medium">
                      {formatQty(oi.delivered_base_quantity, oi.base_unit)}
                    </td>
                    <td className="px-4 py-3 text-right text-sky-700">
                      {formatQty(oi.allocated_base_quantity, oi.base_unit)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {formatQty(oi.current_stock, oi.base_unit)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(oi.base_unit_price)}/{oi.base_unit}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatCurrency(oi.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2 text-sm">
            <h3 className="font-bold text-slate-900 mb-2">Financial Summary</h3>
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Discount</span>
              <span>- {formatCurrency(order.discount_amount)}</span>
            </div>
            <div className="flex justify-between font-bold border-t pt-2">
              <span>Order Total</span>
              <span>{formatCurrency(order.total_amount)}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Net Paid</span>
              <span>{formatCurrency(ps.netPaid)}</span>
            </div>
            <div className="flex justify-between font-bold text-red-600 border-t pt-2">
              <span>Balance Due</span>
              <span>{formatCurrency(ps.balanceDue)}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 text-sm">
            <h3 className="font-bold text-slate-900 mb-2">Delivery Address</h3>
            <div className="font-semibold">{addr.recipient_name}</div>
            <div className="text-xs text-slate-600 mt-1">
              {addr.address_line1}
              {addr.address_line2 ? `, ${addr.address_line2}` : ''}, {addr.city}, {addr.state} -{' '}
              {addr.pincode}
            </div>
            <div className="text-xs text-slate-500 mt-1">Mobile: {addr.mobile}</div>
          </div>
        </div>
      </div>

      {/* Edit Items Modal */}
      <Modal
        open={editModal}
        onClose={() => setEditModal(false)}
        title="Edit Order Items"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveEditedItems} className="space-y-4">
          <div className="space-y-2.5 max-h-80 overflow-y-auto">
            {editItems.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <select
                  value={row.vegetableId}
                  onChange={(e) => {
                    const v = vegetables.find((vg) => String(vg.id) === e.target.value);
                    const next = [...editItems];
                    next[idx] = {
                      ...row,
                      vegetableId: e.target.value,
                      unit: v ? v.unit : row.unit,
                    };
                    setEditItems(next);
                  }}
                  className="col-span-6 px-3 py-2 rounded-xl border border-slate-200 text-sm"
                >
                  {vegetables.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({formatCurrency(v.selling_price)}/{v.pack_size} {v.unit})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  value={row.quantity}
                  onChange={(e) => {
                    const next = [...editItems];
                    next[idx].quantity = e.target.value;
                    setEditItems(next);
                  }}
                  className="col-span-3 px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
                <select
                  value={row.unit}
                  onChange={(e) => {
                    const next = [...editItems];
                    next[idx].unit = e.target.value;
                    setEditItems(next);
                  }}
                  className="col-span-2 px-2 py-2 rounded-xl border border-slate-200 text-sm"
                >
                  {(vegetables.find((vg) => String(vg.id) === String(row.vegetableId))?.base_unit === 'PIECE'
                    ? ['PIECE']
                    : ['KG', 'GRAM']
                  ).map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}
                  className="col-span-1 text-red-500 hover:text-red-700 flex justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setEditItems([
                ...editItems,
                {
                  vegetableId: vegetables[0] ? String(vegetables[0].id) : '',
                  quantity: 1,
                  unit: vegetables[0]?.unit || 'KG',
                },
              ])
            }
            className="text-xs font-semibold text-agro-700 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Add Vegetable Line
          </button>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Discount Amount (Rs.)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={editDiscount}
              onChange={(e) => setEditDiscount(e.target.value)}
              className="w-40 px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700 text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 rounded-xl bg-agro-600 text-white text-sm font-semibold"
            >
              Save & Recalculate
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Record Customer Payment">
        <form onSubmit={handleRecordPayment} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (Rs.)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={ps.balanceDue}
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
              <option value="CASH">CASH</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">BANK_TRANSFER</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Transaction Ref</label>
            <input
              type="text"
              value={payForm.transactionRef}
              onChange={(e) => setPayForm({ ...payForm, transactionRef: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPayModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700 text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 rounded-xl bg-agro-600 text-white text-sm font-semibold"
            >
              Save Payment
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={cancelConfirm}
        onClose={() => setCancelConfirm(false)}
        onConfirm={() => handleStatusChange('CANCELLED', cancelReason || 'Cancelled by admin')}
        loading={busy}
        title="Cancel Customer Order"
        message="Cancelling this order will release any allocated stock and preserve the order history. Continue?"
        confirmText="Cancel Order"
      />
    </div>
  );
}
