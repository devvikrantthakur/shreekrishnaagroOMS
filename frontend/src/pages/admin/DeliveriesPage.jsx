import React, { useState, useEffect, useCallback } from 'react';
import { Truck, CheckCircle2, MapPin, Phone } from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatDateTime, formatQty } from '../../utils/formatters';
import StatusBadge from '../../components/common/StatusBadge';
import Pagination from '../../components/common/Pagination';
import { LoadingSpinner, EmptyState } from '../../components/common/Feedback';
import Modal from '../../components/common/Modal';

export default function DeliveriesPage() {
  const toast = useToast();
  const [tab, setTab] = useState('queue');
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [delivModal, setDelivModal] = useState(null);
  const [delivForm, setDelivForm] = useState({
    driverName: '',
    driverPhone: '',
    notes: '',
    items: [],
  });
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'queue') {
        const res = await api.get('/admin/deliveries/queue');
        setQueue(res.data.data || []);
      } else {
        const res = await api.get('/admin/deliveries', { params: { page, limit: 15 } });
        setHistory(res.data.data.items || []);
        setPagination(res.data.data.pagination);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tab, page, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openDeliveryModal = (ord) => {
    setDelivModal(ord);
    setDelivForm({
      driverName: '',
      driverPhone: '',
      notes: '',
      items: ord.pending_items.map((pi) => ({
        orderItemId: pi.id,
        vegetableName: pi.vegetable_name,
        baseUnit: pi.base_unit,
        remaining: Number(pi.remaining_base_quantity),
        currentStock: Number(pi.current_stock),
        deliverQuantity: Math.min(Number(pi.remaining_base_quantity), Math.max(0, Number(pi.current_stock))),
      })),
    });
  };

  const handleCreateDelivery = async (e) => {
    e.preventDefault();
    const validItems = delivForm.items
      .filter((i) => Number(i.deliverQuantity) > 0)
      .map((i) => ({
        orderItemId: i.orderItemId,
        deliverQuantity: Number(i.deliverQuantity),
        unit: i.baseUnit,
      }));

    if (validItems.length === 0) {
      toast.error('Enter a positive delivery quantity for at least one item.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/admin/deliveries', {
        orderId: delivModal.id,
        driverName: delivForm.driverName || null,
        driverPhone: delivForm.driverPhone || null,
        notes: delivForm.notes || null,
        items: validItems,
      });
      toast.success('Delivery recorded and stock deducted!');
      setDelivModal(null);
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Delivery Management</h1>
          <p className="text-sm text-slate-500">
            Manage delivery queue, record partial/full deliveries, and deduct actual delivered stock
          </p>
        </div>

        <div className="flex bg-white p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setTab('queue')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${
              tab === 'queue' ? 'bg-agro-600 text-white' : 'text-slate-600'
            }`}
          >
            Delivery Queue
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${
              tab === 'history' ? 'bg-agro-600 text-white' : 'text-slate-600'
            }`}
          >
            Delivery History
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading deliveries..." />
      ) : tab === 'queue' ? (
        queue.length === 0 ? (
          <EmptyState
            title="Delivery queue is clear"
            description="Confirmed, processing, or partially delivered orders with pending items appear here."
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {queue.map((ord) => {
              const addr = ord.delivery_address_snapshot || {};
              return (
                <div
                  key={ord.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-900 text-base">{ord.order_number}</span>
                        <span className="ml-2">
                          <StatusBadge status={ord.status} />
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">{formatDateTime(ord.created_at)}</span>
                    </div>

                    <div className="mt-3 p-3 rounded-xl bg-slate-50 text-xs space-y-1">
                      <div className="font-semibold text-slate-900 text-sm">{ord.customer_name}</div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Phone className="w-3.5 h-3.5 text-agro-600" /> {ord.customer_mobile}
                      </div>
                      <div className="flex items-start gap-1.5 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-agro-600 shrink-0 mt-0.5" />
                        <span>
                          {addr.address_line1}, {addr.city} - {addr.pincode}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      <div className="text-xs font-bold uppercase text-slate-500">Pending Items</div>
                      {ord.pending_items.map((pi) => (
                        <div
                          key={pi.id}
                          className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0"
                        >
                          <span className="font-medium text-slate-800">{pi.vegetable_name}</span>
                          <div className="text-right">
                            <span className="font-bold text-slate-900">
                              Need: {formatQty(pi.remaining_base_quantity, pi.base_unit)}
                            </span>
                            <span
                              className={`ml-2 text-[11px] ${
                                Number(pi.current_stock) >= Number(pi.remaining_base_quantity)
                                  ? 'text-emerald-700'
                                  : 'text-red-600 font-semibold'
                              }`}
                            >
                              (Stock: {formatQty(pi.current_stock, pi.base_unit)})
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => openDeliveryModal(ord)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-agro-600 hover:bg-agro-700 text-white text-sm font-semibold"
                  >
                    <Truck className="w-4 h-4" /> Record Delivery
                  </button>
                </div>
              );
            })}
          </div>
        )
      ) : history.length === 0 ? (
        <EmptyState title="No delivery history yet" />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Delivery #</th>
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Driver</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{d.delivery_number}</td>
                    <td className="px-4 py-3 text-agro-700 font-medium">{d.order_number}</td>
                    <td className="px-4 py-3">
                      {d.customer_name}
                      <span className="block text-xs text-slate-400">{d.customer_mobile}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(d.delivery_date)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {d.driver_name || '-'} {d.driver_phone ? `(${d.driver_phone})` : ''}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
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

      {/* Record Delivery Modal */}
      <Modal
        open={Boolean(delivModal)}
        onClose={() => setDelivModal(null)}
        title={`Record Delivery — ${delivModal?.order_number || ''}`}
        maxWidth="max-w-2xl"
      >
        {delivModal && (
          <form onSubmit={handleCreateDelivery} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Driver Name (Optional)
                </label>
                <input
                  type="text"
                  value={delivForm.driverName}
                  onChange={(e) => setDelivForm({ ...delivForm, driverName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Driver Phone (Optional)
                </label>
                <input
                  type="text"
                  value={delivForm.driverPhone}
                  onChange={(e) => setDelivForm({ ...delivForm, driverPhone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-2">Vegetable</th>
                    <th className="px-3 py-2 text-right">Remaining</th>
                    <th className="px-3 py-2 text-right">In Stock</th>
                    <th className="px-3 py-2 text-right">Deliver Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {delivForm.items.map((item, idx) => (
                    <tr key={item.orderItemId}>
                      <td className="px-3 py-2 font-semibold">{item.vegetableName}</td>
                      <td className="px-3 py-2 text-right">
                        {formatQty(item.remaining, item.baseUnit)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatQty(item.currentStock, item.baseUnit)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          max={item.remaining}
                          value={item.deliverQuantity}
                          onChange={(e) => {
                            const next = [...delivForm.items];
                            next[idx].deliverQuantity = e.target.value;
                            setDelivForm({ ...delivForm, items: next });
                          }}
                          className="w-24 px-2 py-1 rounded-lg border border-slate-200 text-right font-semibold"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDelivModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-agro-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {submitting ? 'Recording...' : 'Confirm & Deduct Stock'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
