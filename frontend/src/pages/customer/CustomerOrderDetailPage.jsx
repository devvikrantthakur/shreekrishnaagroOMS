import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CreditCard, FileDown, MapPin, Truck } from 'lucide-react';
import api, { downloadFileWithAuth, getErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDateTime, formatQty } from '../../utils/formatters';
import StatusBadge from '../../components/common/StatusBadge';
import { LoadingSpinner } from '../../components/common/Feedback';
import Modal from '../../components/common/Modal';

export default function CustomerOrderDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const [payModal, setPayModal] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: '',
    paymentMethod: 'UPI',
    transactionRef: '',
    remarks: '',
  });
  const [paying, setPaying] = useState(false);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/orders/${id}`);
      const data = res.data.data;
      setOrder(data);
      if (data.paymentSummary?.balanceDue > 0) {
        setPayForm((f) => ({ ...f, amount: String(data.paymentSummary.balanceDue) }));
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    setPaying(true);
    try {
      await api.post('/payments', {
        orderId: order.id,
        amount: Number(payForm.amount),
        paymentMethod: payForm.paymentMethod,
        transactionRef: payForm.transactionRef || null,
        remarks: payForm.remarks || null,
      });
      toast.success('Payment recorded successfully.');
      setPayModal(false);
      await loadOrder();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPaying(false);
    }
  };

  if (loading || !order) return <LoadingSpinner label="Loading order details..." />;

  const addr = order.delivery_address_snapshot || {};
  const ps = order.paymentSummary || {};
  const activeInvoice = (order.invoices || []).find((i) => i.status === 'ISSUED');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/orders"
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-agro-700 mb-1"
          >
            <ArrowLeft className="w-4 h-4" /> Back to My Orders
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{order.order_number}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Placed on {formatDateTime(order.created_at)}</p>
        </div>

        <div className="flex items-center gap-2">
          {activeInvoice && (
            <button
              onClick={() =>
                downloadFileWithAuth(
                  `/invoices/${activeInvoice.id}/pdf`,
                  `Invoice-${activeInvoice.invoice_number}.pdf`
                )
              }
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700"
            >
              <FileDown className="w-4 h-4 text-agro-600" /> Download Invoice PDF
            </button>
          )}
          {order.status !== 'CANCELLED' && ps.balanceDue > 0 && (
            <button
              onClick={() => setPayModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-agro-600 hover:bg-agro-700 text-white text-sm font-semibold"
            >
              <CreditCard className="w-4 h-4" /> Pay Now ({formatCurrency(ps.balanceDue)})
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Items Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 font-bold text-slate-900">
              Ordered Vegetables
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Vegetable</th>
                    <th className="px-4 py-3 text-right">Ordered</th>
                    <th className="px-4 py-3 text-right">Delivered</th>
                    <th className="px-4 py-3 text-right">Rate</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {item.vegetable_name_snapshot}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatQty(item.quantity, item.unit)}
                        <span className="block text-[11px] text-slate-400">
                          ({formatQty(item.base_quantity, item.base_unit)})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-medium">
                        {formatQty(item.delivered_base_quantity, item.base_unit)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatCurrency(item.base_unit_price)}/{item.base_unit}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(item.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Deliveries & Payments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-3">
                <Truck className="w-4 h-4 text-agro-600" /> Deliveries ({order.deliveries.length})
              </h3>
              {order.deliveries.length === 0 ? (
                <p className="text-xs text-slate-500">No deliveries dispatched yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {order.deliveries.map((d) => (
                    <div key={d.id} className="p-3 rounded-xl bg-slate-50 text-xs">
                      <div className="flex justify-between font-semibold text-slate-800">
                        <span>{d.delivery_number}</span>
                        <StatusBadge status={d.status} />
                      </div>
                      <div className="text-slate-500 mt-1">{formatDateTime(d.delivery_date)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-agro-600" /> Payments ({order.payments.length})
              </h3>
              {order.payments.length === 0 ? (
                <p className="text-xs text-slate-500">No payments recorded yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {order.payments.map((p) => (
                    <div key={p.id} className="p-3 rounded-xl bg-slate-50 text-xs">
                      <div className="flex justify-between font-semibold text-slate-800">
                        <span>{formatCurrency(p.amount)}</span>
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="text-slate-500 mt-1">
                        {p.payment_method} • {formatDateTime(p.payment_date)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary & Address */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2.5 text-sm">
            <h3 className="font-bold text-slate-900 mb-2">Payment Summary</h3>
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Discount</span>
              <span>- {formatCurrency(order.discount_amount)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 border-t pt-2">
              <span>Order Total</span>
              <span>{formatCurrency(order.total_amount)}</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-medium">
              <span>Net Paid</span>
              <span>{formatCurrency(ps.netPaid)}</span>
            </div>
            <div className="flex justify-between font-bold text-red-600 border-t pt-2">
              <span>Balance Due</span>
              <span>{formatCurrency(ps.balanceDue)}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 text-sm">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-agro-600" /> Delivery Address
            </h3>
            <div className="font-semibold text-slate-800">{addr.recipient_name}</div>
            <div className="text-slate-600 text-xs mt-1 leading-relaxed">
              {addr.address_line1}
              {addr.address_line2 ? `, ${addr.address_line2}` : ''}
              <br />
              {addr.city}, {addr.state} - {addr.pincode}
            </div>
            <div className="text-xs text-slate-500 mt-2">Phone: {addr.mobile}</div>
          </div>
        </div>
      </div>

      <Modal open={payModal} onClose={() => setPayModal(false)} title="Make Payment">
        <form onSubmit={handlePaySubmit} className="space-y-4">
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
            <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Method</label>
            <select
              value={payForm.paymentMethod}
              onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            >
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">BANK TRANSFER</option>
              <option value="CASH">CASH (Pay on Delivery)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Transaction Reference (UTR / UPI Ref)
            </label>
            <input
              type="text"
              value={payForm.transactionRef}
              onChange={(e) => setPayForm({ ...payForm, transactionRef: e.target.value })}
              placeholder="Optional for CASH"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPayModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={paying}
              className="px-4 py-2 rounded-xl bg-agro-600 text-white text-sm font-semibold disabled:opacity-60"
            >
              {paying ? 'Recording...' : 'Submit Payment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
