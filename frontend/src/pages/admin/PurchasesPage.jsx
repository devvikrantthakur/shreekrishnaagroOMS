import React, { useState, useEffect, useCallback } from 'react';
import { Plus, PackageCheck, XCircle, Trash2 } from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDate, formatQty } from '../../utils/formatters';
import StatusBadge from '../../components/common/StatusBadge';
import Pagination from '../../components/common/Pagination';
import { LoadingSpinner, EmptyState } from '../../components/common/Feedback';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';

export default function PurchasesPage() {
  const toast = useToast();
  const [purchases, setPurchases] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [vegetables, setVegetables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  // Create PO Modal
  const [createModal, setCreateModal] = useState(false);
  const [poForm, setPoForm] = useState({
    supplierId: '',
    supplierInvoiceRef: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    notes: '',
    items: [],
  });

  // Receive PO Modal
  const [receivePo, setReceivePo] = useState(null);
  const [receiveItems, setReceiveItems] = useState([]);
  const [receiveInvoiceRef, setReceiveInvoiceRef] = useState('');

  // Cancel PO confirm
  const [cancelTarget, setCancelTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [poRes, supRes, vegRes] = await Promise.all([
        api.get('/admin/purchases', {
          params: { page, limit: 15, status: statusFilter || undefined },
        }),
        api.get('/admin/suppliers', { params: { status: 'ACTIVE', limit: 100 } }),
        api.get('/admin/vegetables', { params: { limit: 200 } }),
      ]);
      setPurchases(poRes.data.data.items || []);
      setPagination(poRes.data.data.pagination);
      setSuppliers(supRes.data.data.items || []);
      setVegetables(vegRes.data.data.items || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setPoForm({
      supplierId: suppliers[0] ? String(suppliers[0].id) : '',
      supplierInvoiceRef: '',
      purchaseDate: new Date().toISOString().slice(0, 10),
      notes: '',
      items: vegetables[0]
        ? [{ vegetableId: String(vegetables[0].id), quantity: 10, unit: vegetables[0].base_unit, unitCost: 25 }]
        : [],
    });
    setCreateModal(true);
  };

  const handleCreatePO = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/admin/purchases', {
        supplierId: poForm.supplierId,
        supplierInvoiceRef: poForm.supplierInvoiceRef || null,
        purchaseDate: poForm.purchaseDate,
        notes: poForm.notes || null,
        items: poForm.items.map((i) => ({
          vegetableId: i.vegetableId,
          quantity: Number(i.quantity),
          unit: i.unit,
          unitCost: Number(i.unitCost),
        })),
      });
      toast.success('Purchase Order created.');
      setCreateModal(false);
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const openReceiveModal = async (poId) => {
    try {
      const res = await api.get(`/admin/purchases/${poId}`);
      const detail = res.data.data;
      setReceivePo(detail);
      setReceiveInvoiceRef(detail.supplier_invoice_ref || '');
      setReceiveItems(
        detail.items
          .filter((i) => Number(i.pending_quantity) > 0)
          .map((i) => ({
            purchaseItemId: i.id,
            vegetableName: i.vegetable_name,
            unit: i.unit,
            ordered: Number(i.ordered_quantity),
            alreadyReceived: Number(i.received_quantity),
            pending: Number(i.pending_quantity),
            receiveQuantity: Number(i.pending_quantity),
          }))
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleReceivePO = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/admin/purchases/${receivePo.id}/receive`, {
        supplierInvoiceRef: receiveInvoiceRef || null,
        items: receiveItems
          .filter((i) => Number(i.receiveQuantity) > 0)
          .map((i) => ({
            purchaseItemId: i.purchaseItemId,
            receiveQuantity: Number(i.receiveQuantity),
          })),
      });
      toast.success('Stock received and inventory ledger updated!');
      setReceivePo(null);
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPO = async () => {
    setSubmitting(true);
    try {
      await api.post(`/admin/purchases/${cancelTarget.id}/cancel`, {
        reason: 'Cancelled by admin',
      });
      toast.success('Purchase order cancelled.');
      setCancelTarget(null);
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setCancelTarget(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchase Management</h1>
          <p className="text-sm text-slate-500">
            Create purchase orders, record partial/full receipts into inventory, or cancel with reversal
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="ORDERED">ORDERED</option>
            <option value="PARTIALLY_RECEIVED">PARTIALLY RECEIVED</option>
            <option value="RECEIVED">RECEIVED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-agro-600 hover:bg-agro-700 text-white text-sm font-semibold"
          >
            <Plus className="w-4 h-4" /> New Purchase Order
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading purchase orders..." />
      ) : purchases.length === 0 ? (
        <EmptyState title="No purchase orders found" />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">PO #</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Invoice Ref</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((po) => (
                  <tr key={po.id}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{po.purchase_number}</td>
                    <td className="px-4 py-3">{po.supplier_name}</td>
                    <td className="px-4 py-3 text-slate-500">{po.supplier_invoice_ref || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(po.purchase_date)}</td>
                    <td className="px-4 py-3"><StatusBadge status={po.status} /></td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(po.total_amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(po.status) && (
                          <button
                            onClick={() => openReceiveModal(po.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-agro-50 text-agro-700 hover:bg-agro-100 text-xs font-semibold"
                          >
                            <PackageCheck className="w-3.5 h-3.5" /> Receive
                          </button>
                        )}
                        {po.status !== 'CANCELLED' && (
                          <button
                            onClick={() => setCancelTarget(po)}
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

      {/* Create PO Modal */}
      <Modal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="Create Purchase Order"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreatePO} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Supplier *</label>
              <select
                required
                value={poForm.supplierId}
                onChange={(e) => setPoForm({ ...poForm, supplierId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.supplier_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Date *</label>
              <input
                type="date"
                required
                value={poForm.purchaseDate}
                onChange={(e) => setPoForm({ ...poForm, purchaseDate: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Supplier Invoice Ref
              </label>
              <input
                type="text"
                value={poForm.supplierInvoiceRef}
                onChange={(e) => setPoForm({ ...poForm, supplierInvoiceRef: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {poForm.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <select
                  value={item.vegetableId}
                  onChange={(e) => {
                    const v = vegetables.find((vg) => String(vg.id) === e.target.value);
                    const next = [...poForm.items];
                    next[idx] = {
                      ...item,
                      vegetableId: e.target.value,
                      unit: v?.base_unit || 'KG',
                    };
                    setPoForm({ ...poForm, items: next });
                  }}
                  className="col-span-5 px-3 py-2 rounded-xl border border-slate-200 text-sm"
                >
                  {vegetables.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.base_unit})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => {
                    const next = [...poForm.items];
                    next[idx].quantity = e.target.value;
                    setPoForm({ ...poForm, items: next });
                  }}
                  className="col-span-2 px-2.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
                <select
                  value={item.unit}
                  onChange={(e) => {
                    const next = [...poForm.items];
                    next[idx].unit = e.target.value;
                    setPoForm({ ...poForm, items: next });
                  }}
                  className="col-span-2 px-2 py-2 rounded-xl border border-slate-200 text-sm"
                >
                  {(vegetables.find((vg) => String(vg.id) === String(item.vegetableId))?.base_unit === 'PIECE'
                    ? ['PIECE']
                    : ['KG', 'GRAM']
                  ).map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="Cost/unit"
                  value={item.unitCost}
                  onChange={(e) => {
                    const next = [...poForm.items];
                    next[idx].unitCost = e.target.value;
                    setPoForm({ ...poForm, items: next });
                  }}
                  className="col-span-2 px-2.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    setPoForm({ ...poForm, items: poForm.items.filter((_, i) => i !== idx) })
                  }
                  className="col-span-1 text-red-500 flex justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setPoForm({
                ...poForm,
                items: [
                  ...poForm.items,
                  {
                    vegetableId: vegetables[0] ? String(vegetables[0].id) : '',
                    quantity: 10,
                    unit: vegetables[0]?.base_unit || 'KG',
                    unitCost: 25,
                  },
                ],
              })
            }
            className="text-xs font-semibold text-agro-700"
          >
            + Add Vegetable
          </button>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCreateModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl bg-agro-600 text-white text-sm font-semibold">
              {submitting ? 'Creating...' : 'Create Purchase Order'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Receive PO Modal */}
      <Modal
        open={Boolean(receivePo)}
        onClose={() => setReceivePo(null)}
        title={`Receive Stock — ${receivePo?.purchase_number || ''}`}
        maxWidth="max-w-2xl"
      >
        {receivePo && (
          <form onSubmit={handleReceivePO} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Supplier Invoice Reference
              </label>
              <input
                type="text"
                value={receiveInvoiceRef}
                onChange={(e) => setReceiveInvoiceRef(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-2">Vegetable</th>
                    <th className="px-3 py-2 text-right">Ordered</th>
                    <th className="px-3 py-2 text-right">Pending</th>
                    <th className="px-3 py-2 text-right">Receive Now</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receiveItems.map((item, idx) => (
                    <tr key={item.purchaseItemId}>
                      <td className="px-3 py-2 font-semibold">{item.vegetableName}</td>
                      <td className="px-3 py-2 text-right">{formatQty(item.ordered, item.unit)}</td>
                      <td className="px-3 py-2 text-right">{formatQty(item.pending, item.unit)}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          max={item.pending}
                          value={item.receiveQuantity}
                          onChange={(e) => {
                            const next = [...receiveItems];
                            next[idx].receiveQuantity = e.target.value;
                            setReceiveItems(next);
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
              <button type="button" onClick={() => setReceivePo(null)} className="px-4 py-2 rounded-xl bg-slate-100 text-sm">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl bg-agro-600 text-white text-sm font-semibold">
                {submitting ? 'Updating Ledger...' : 'Confirm Receipt & Add Stock'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelPO}
        loading={submitting}
        title="Cancel Purchase Order"
        message={`Cancel PO ${cancelTarget?.purchase_number}? If any stock was already received, a stock REVERSAL movement will be created if current stock covers it.`}
        confirmText="Cancel Purchase Order"
      />
    </div>
  );
}
