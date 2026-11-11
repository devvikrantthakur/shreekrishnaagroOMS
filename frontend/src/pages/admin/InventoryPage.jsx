import React, { useState, useEffect, useCallback } from 'react';
import { SlidersHorizontal, Search } from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDateTime, formatQty } from '../../utils/formatters';
import StatusBadge from '../../components/common/StatusBadge';
import Pagination from '../../components/common/Pagination';
import { LoadingSpinner, EmptyState } from '../../components/common/Feedback';
import Modal from '../../components/common/Modal';

export default function InventoryPage() {
  const toast = useToast();
  const [tab, setTab] = useState('summary');
  const [summary, setSummary] = useState([]);
  const [movements, setMovements] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const [adjModal, setAdjModal] = useState(false);
  const [adjForm, setAdjForm] = useState({
    vegetableId: '',
    movementType: 'ADJUSTMENT_IN',
    quantity: '',
    unit: 'KG',
    remarks: '',
  });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'summary') {
        const res = await api.get('/admin/inventory', {
          params: { search: search || undefined, lowStockOnly: lowStockOnly ? 'true' : undefined },
        });
        setSummary(res.data.data || []);
      } else {
        const res = await api.get('/admin/inventory/movements', { params: { page, limit: 20 } });
        setMovements(res.data.data.items || []);
        setPagination(res.data.data.pagination);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tab, search, lowStockOnly, page, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAdjustModal = (veg = null) => {
    const target = veg || summary[0];
    setAdjForm({
      vegetableId: target ? String(target.vegetable_id) : '',
      movementType: 'ADJUSTMENT_IN',
      quantity: '',
      unit: target?.base_unit || 'KG',
      remarks: '',
    });
    setAdjModal(true);
  };

  const handleAdjustment = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/inventory/adjustments', {
        vegetableId: adjForm.vegetableId,
        movementType: adjForm.movementType,
        quantity: Number(adjForm.quantity),
        unit: adjForm.unit,
        remarks: adjForm.remarks,
      });
      toast.success('Stock adjustment recorded in ledger.');
      setAdjModal(false);
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory & Stock Ledger</h1>
          <p className="text-sm text-slate-500">
            Real-time stock calculated from stock_movements ledger with reserved allocation tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setTab('summary')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${
                tab === 'summary' ? 'bg-agro-600 text-white' : 'text-slate-600'
              }`}
            >
              Stock Summary
            </button>
            <button
              onClick={() => setTab('movements')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${
                tab === 'movements' ? 'bg-agro-600 text-white' : 'text-slate-600'
              }`}
            >
              Movement Ledger
            </button>
          </div>
          <button
            onClick={() => openAdjustModal()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
          >
            <SlidersHorizontal className="w-4 h-4" /> Stock Adjustment
          </button>
        </div>
      </div>

      {tab === 'summary' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vegetable..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="accent-agro-600"
            />
            Low Stock Only
          </label>
        </div>
      )}

      {loading ? (
        <LoadingSpinner label="Loading inventory ledger..." />
      ) : tab === 'summary' ? (
        summary.length === 0 ? (
          <EmptyState title="No inventory items found" />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Vegetable</th>
                    <th className="px-4 py-3 text-right">Current Stock</th>
                    <th className="px-4 py-3 text-right">Reserved</th>
                    <th className="px-4 py-3 text-right">Available</th>
                    <th className="px-4 py-3 text-right">Weighted Avg Cost</th>
                    <th className="px-4 py-3 text-right">Valuation</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.map((item) => (
                    <tr key={item.vegetable_id} className={item.is_low_stock ? 'bg-amber-50/40' : ''}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="text-xs text-slate-400">
                          {item.category_name} • Threshold: {formatQty(item.min_stock_threshold, item.base_unit)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatQty(item.current_stock, item.base_unit)}
                      </td>
                      <td className="px-4 py-3 text-right text-sky-700">
                        {formatQty(item.reserved_stock, item.base_unit)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold ${
                          item.is_low_stock ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {formatQty(item.available_stock, item.base_unit)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(item.weighted_avg_cost)}/{item.base_unit}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(item.inventory_value)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openAdjustModal(item)}
                          className="text-xs font-semibold text-agro-700 hover:underline"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Vegetable</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Qty Change</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(m.movement_date)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{m.vegetable_name}</td>
                    <td className="px-4 py-3"><StatusBadge status={m.movement_type} /></td>
                    <td
                      className={`px-4 py-3 text-right font-bold ${
                        Number(m.signed_quantity) >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {Number(m.signed_quantity) >= 0 ? '+' : ''}
                      {formatQty(m.signed_quantity, m.base_unit)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {m.reference_type} {m.reference_id ? `#${m.reference_id}` : ''}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{m.remarks || '-'}</td>
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

      <Modal open={adjModal} onClose={() => setAdjModal(false)} title="Create Stock Adjustment">
        <form onSubmit={handleAdjustment} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Vegetable *</label>
            <select
              required
              value={adjForm.vegetableId}
              onChange={(e) => {
                const v = summary.find((s) => String(s.vegetable_id) === e.target.value);
                setAdjForm({
                  ...adjForm,
                  vegetableId: e.target.value,
                  unit: v?.base_unit || 'KG',
                });
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            >
              {summary.map((s) => (
                <option key={s.vegetable_id} value={s.vegetable_id}>
                  {s.name} (Stock: {formatQty(s.current_stock, s.base_unit)})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
              <select
                value={adjForm.movementType}
                onChange={(e) => setAdjForm({ ...adjForm, movementType: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              >
                <option value="ADJUSTMENT_IN">ADJUSTMENT_IN (+)</option>
                <option value="ADJUSTMENT_OUT">ADJUSTMENT_OUT (-)</option>
                <option value="RETURN_IN">RETURN_IN (+)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Quantity *</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                required
                value={adjForm.quantity}
                onChange={(e) => setAdjForm({ ...adjForm, quantity: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Unit</label>
              <select
                value={adjForm.unit}
                onChange={(e) => setAdjForm({ ...adjForm, unit: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              >
                {(summary.find((s) => String(s.vegetable_id) === String(adjForm.vegetableId))?.base_unit === 'PIECE'
                  ? ['PIECE']
                  : ['KG', 'GRAM']
                ).map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Remarks *</label>
            <input
              type="text"
              required
              placeholder="e.g. Spoilage/wastage write-off or physical stock count correction"
              value={adjForm.remarks}
              onChange={(e) => setAdjForm({ ...adjForm, remarks: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAdjModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-agro-600 text-white text-sm font-semibold"
            >
              {saving ? 'Recording...' : 'Record Adjustment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
