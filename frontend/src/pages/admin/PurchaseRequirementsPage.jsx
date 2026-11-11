import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ShoppingCart, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatQty } from '../../utils/formatters';
import { LoadingSpinner, EmptyState } from '../../components/common/Feedback';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';

export default function PurchaseRequirementsPage() {
  const toast = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [onlyShortages, setOnlyShortages] = useState(false);
  const [loading, setLoading] = useState(true);

  // Selected items map: { [vegId]: { checked, quantity, unitCost } }
  const [selections, setSelections] = useState({});
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [poForm, setPoForm] = useState({
    supplierId: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    supplierInvoiceRef: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, supRes] = await Promise.all([
        api.get('/admin/purchase-requirements', {
          params: { onlyShortages: onlyShortages ? 'true' : 'false' },
        }),
        api.get('/admin/suppliers', { params: { status: 'ACTIVE', limit: 100 } }),
      ]);
      const reqData = reqRes.data.data;
      setData(reqData);
      setSuppliers(supRes.data.data.items || []);

      const initSel = {};
      for (const item of reqData.items) {
        initSel[item.vegetable_id] = {
          checked: item.purchase_shortage > 0,
          quantity: item.purchase_shortage > 0 ? item.purchase_shortage : 0,
          unitCost: item.last_avg_cost || 0,
        };
      }
      setSelections(initSel);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [onlyShortages, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedList = (data?.items || []).filter(
    (item) => selections[item.vegetable_id]?.checked && Number(selections[item.vegetable_id]?.quantity) > 0
  );

  const handleOpenGenerateModal = () => {
    if (selectedList.length === 0) {
      toast.error('Select at least one vegetable with quantity > 0.');
      return;
    }
    if (!poForm.supplierId && suppliers.length > 0) {
      setPoForm((f) => ({ ...f, supplierId: String(suppliers[0].id) }));
    }
    setPoModalOpen(true);
  };

  const handleConfirmGeneratePO = async () => {
    setSubmitting(true);
    try {
      const items = selectedList.map((item) => ({
        vegetableId: item.vegetable_id,
        quantity: Number(selections[item.vegetable_id].quantity),
        unit: item.base_unit,
        unitCost: Number(selections[item.vegetable_id].unitCost || 0),
      }));
      const res = await api.post('/admin/purchase-requirements/generate-po', {
        supplierId: poForm.supplierId,
        purchaseDate: poForm.purchaseDate,
        supplierInvoiceRef: poForm.supplierInvoiceRef || null,
        notes: poForm.notes || null,
        items,
      });
      toast.success(`Purchase Order ${res.data.data.purchase_number} created!`);
      setConfirmOpen(false);
      setPoModalOpen(false);
      navigate('/admin/purchases');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Automatic Vegetable Purchase Requirements</h1>
          <p className="text-sm text-slate-500">
            Formula: Purchase Shortage = MAX(0, Unallocated Confirmed Demand − Available Unallocated Stock)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyShortages}
              onChange={(e) => setOnlyShortages(e.target.checked)}
              className="accent-agro-600"
            />
            Only Shortages
          </label>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" /> Recalculate
          </button>
          <button
            onClick={handleOpenGenerateModal}
            disabled={selectedList.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-agro-600 hover:bg-agro-700 text-white text-sm font-semibold disabled:opacity-50"
          >
            <ShoppingCart className="w-4 h-4" /> Generate PO ({selectedList.length})
          </button>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase">Items With Demand</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {data.summary.totalItemsWithDemand}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-red-200 p-4">
            <div className="text-xs font-semibold text-red-600 uppercase">Items Requiring Purchase</div>
            <div className="text-2xl font-bold text-red-700 mt-1">
              {data.summary.itemsRequiringPurchase}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase">Total Shortage Units</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {formatQty(data.summary.totalShortageUnits)}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSpinner label="Calculating live demand & stock shortages..." />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No confirmed order demand or shortages"
          description="Confirmed customer orders will automatically appear here with live stock shortage calculations."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Select</th>
                  <th className="px-4 py-3">Vegetable</th>
                  <th className="px-4 py-3 text-right">Confirmed Demand</th>
                  <th className="px-4 py-3 text-right">Current Stock</th>
                  <th className="px-4 py-3 text-right">Allocated</th>
                  <th className="px-4 py-3 text-right">Avail. Unallocated</th>
                  <th className="px-4 py-3 text-right">Purchase Shortage</th>
                  <th className="px-4 py-3 text-right">Incoming PO</th>
                  <th className="px-4 py-3 text-right">Adjust PO Qty</th>
                  <th className="px-4 py-3 text-right">Est. Cost / Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((item) => {
                  const sel = selections[item.vegetable_id] || {
                    checked: false,
                    quantity: 0,
                    unitCost: 0,
                  };
                  const hasShortage = item.purchase_shortage > 0;
                  return (
                    <tr
                      key={item.vegetable_id}
                      className={hasShortage ? 'bg-red-50/30' : 'hover:bg-slate-50/60'}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={sel.checked}
                          onChange={(e) =>
                            setSelections((prev) => ({
                              ...prev,
                              [item.vegetable_id]: { ...sel, checked: e.target.checked },
                            }))
                          }
                          className="accent-agro-600 w-4 h-4"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{item.vegetable_name}</div>
                        <div className="text-xs text-slate-400">
                          {item.category_name} • Base: {item.base_unit}
                          {item.pending_unconfirmed_demand > 0 &&
                            ` • Unconfirmed: ${formatQty(item.pending_unconfirmed_demand, item.base_unit)}`}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatQty(item.total_confirmed_demand, item.base_unit)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatQty(item.current_stock, item.base_unit)}
                      </td>
                      <td className="px-4 py-3 text-right text-sky-700">
                        {formatQty(item.allocated_stock, item.base_unit)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-700">
                        {formatQty(item.available_unallocated_stock, item.base_unit)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {hasShortage ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {formatQty(item.purchase_shortage, item.base_unit)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 0 {item.base_unit}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {formatQty(item.incoming_po_stock, item.base_unit)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={sel.quantity}
                          onChange={(e) =>
                            setSelections((prev) => ({
                              ...prev,
                              [item.vegetable_id]: {
                                ...sel,
                                quantity: e.target.value,
                                checked: Number(e.target.value) > 0,
                              },
                            }))
                          }
                          className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 text-right text-xs font-semibold"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={sel.unitCost}
                          onChange={(e) =>
                            setSelections((prev) => ({
                              ...prev,
                              [item.vegetable_id]: { ...sel, unitCost: e.target.value },
                            }))
                          }
                          className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 text-right text-xs font-semibold"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Generate PO Modal */}
      <Modal
        open={poModalOpen}
        onClose={() => setPoModalOpen(false)}
        title="Generate Purchase Order from Shortages"
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Supplier</label>
              <select
                value={poForm.supplierId}
                onChange={(e) => setPoForm({ ...poForm, supplierId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              >
                <option value="">Select Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.supplier_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Purchase Date</label>
              <input
                type="date"
                value={poForm.purchaseDate}
                onChange={(e) => setPoForm({ ...poForm, purchaseDate: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Supplier Invoice Ref (Optional)
            </label>
            <input
              type="text"
              value={poForm.supplierInvoiceRef}
              onChange={(e) => setPoForm({ ...poForm, supplierInvoiceRef: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
          </div>

          <div className="bg-slate-50 rounded-xl p-3 max-h-56 overflow-y-auto space-y-2 text-xs">
            <div className="font-bold text-slate-700">Selected Items ({selectedList.length})</div>
            {selectedList.map((item) => {
              const sel = selections[item.vegetable_id];
              const line = Number(sel.quantity) * Number(sel.unitCost);
              return (
                <div key={item.vegetable_id} className="flex justify-between">
                  <span>
                    {item.vegetable_name}: <strong>{formatQty(sel.quantity, item.base_unit)}</strong> @{' '}
                    {formatCurrency(sel.unitCost)}
                  </span>
                  <span className="font-semibold">{formatCurrency(line)}</span>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setPoModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              disabled={!poForm.supplierId}
              onClick={() => setConfirmOpen(true)}
              className="px-4 py-2 rounded-xl bg-agro-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              Review & Confirm PO
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmGeneratePO}
        danger={false}
        loading={submitting}
        title="Confirm Purchase Order Creation"
        message={`Create a Purchase Order for ${selectedList.length} vegetable(s) with the adjusted quantities?`}
        confirmText="Create Purchase Order"
      />
    </div>
  );
}
