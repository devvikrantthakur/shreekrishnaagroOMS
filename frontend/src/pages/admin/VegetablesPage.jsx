import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit3, Trash2, RotateCcw, Eye, Leaf } from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDateTime, formatQty, resolveImageUrl } from '../../utils/formatters';
import StatusBadge from '../../components/common/StatusBadge';
import Pagination from '../../components/common/Pagination';
import { LoadingSpinner, EmptyState } from '../../components/common/Feedback';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';

export default function VegetablesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [vegetables, setVegetables] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    search: '',
    categoryId: '',
    status: '',
    includeDeleted: false,
    page: 1,
  });

  const [formModal, setFormModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    categoryId: '',
    name: '',
    sku: '',
    description: '',
    unit: 'KG',
    packSize: '1',
    sellingPrice: '',
    minStockThreshold: '10',
    status: 'ACTIVE',
  });
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailVeg, setDetailVeg] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [vegRes, catRes] = await Promise.all([
        api.get('/admin/vegetables', {
          params: {
            page: filters.page,
            limit: 15,
            search: filters.search || undefined,
            categoryId: filters.categoryId || undefined,
            status: filters.status || undefined,
            includeDeleted: filters.includeDeleted ? 'true' : undefined,
          },
        }),
        api.get('/admin/categories'),
      ]);
      setVegetables(vegRes.data.data.items || []);
      setPagination(vegRes.data.data.pagination);
      setCategories(catRes.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAdd = () => {
    setEditingId(null);
    setForm({
      categoryId: categories[0] ? String(categories[0].id) : '',
      name: '',
      sku: '',
      description: '',
      unit: 'KG',
      packSize: '1',
      sellingPrice: '',
      minStockThreshold: '10',
      status: 'ACTIVE',
    });
    setImageFile(null);
    setFormModal(true);
  };

  const openEdit = (v) => {
    setEditingId(v.id);
    setForm({
      categoryId: String(v.category_id),
      name: v.name,
      sku: v.sku || '',
      description: v.description || '',
      unit: v.unit,
      packSize: String(v.pack_size),
      sellingPrice: String(v.selling_price),
      minStockThreshold: String(v.min_stock_threshold),
      status: v.status,
    });
    setImageFile(null);
    setFormModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (imageFile) fd.append('image', imageFile);

      if (editingId) {
        await api.put(`/admin/vegetables/${editingId}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Vegetable updated.');
      } else {
        await api.post('/admin/vegetables', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Vegetable created.');
      }
      setFormModal(false);
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSoftDelete = async () => {
    try {
      await api.delete(`/admin/vegetables/${deleteTarget.id}`);
      toast.success('Vegetable soft-deleted.');
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeleteTarget(null);
    }
  };

  const handleRestore = async (id) => {
    try {
      await api.post(`/admin/vegetables/${id}/restore`);
      toast.success('Vegetable restored.');
      await loadData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const openDetails = async (id) => {
    try {
      const res = await api.get(`/admin/vegetables/${id}`);
      setDetailVeg(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vegetable Master</h1>
          <p className="text-sm text-slate-500">
            Manage vegetable catalog, pricing, pack sizes, images and stock thresholds
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-agro-600 hover:bg-agro-700 text-white text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Add Vegetable
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
            placeholder="Search name or SKU..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
        </div>
        <select
          value={filters.categoryId}
          onChange={(e) => setFilters({ ...filters, categoryId: e.target.value, page: 1 })}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
        {isSuperAdmin && (
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.includeDeleted}
              onChange={(e) =>
                setFilters({ ...filters, includeDeleted: e.target.checked, page: 1 })
              }
              className="accent-agro-600"
            />
            Show Deleted
          </label>
        )}
      </div>

      {loading ? (
        <LoadingSpinner label="Loading vegetables..." />
      ) : vegetables.length === 0 ? (
        <EmptyState title="No vegetables found" />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Vegetable</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Pack / Unit</th>
                  <th className="px-4 py-3 text-right">Selling Price</th>
                  <th className="px-4 py-3 text-right">Current Stock</th>
                  <th className="px-4 py-3 text-right">Available</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vegetables.map((v) => (
                  <tr key={v.id} className={v.is_deleted ? 'bg-red-50/40' : 'hover:bg-slate-50/60'}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-agro-50 overflow-hidden flex items-center justify-center shrink-0">
                          {v.image_url ? (
                            <img
                              src={resolveImageUrl(v.image_url)}
                              alt={v.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Leaf className="w-5 h-5 text-agro-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{v.name}</div>
                          <div className="text-xs text-slate-400">{v.sku || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{v.category_name}</td>
                    <td className="px-4 py-3">
                      {formatQty(v.pack_size, v.unit)}
                      <span className="block text-[11px] text-slate-400">Base: {v.base_unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatCurrency(v.selling_price)}
                    </td>
                    <td className="px-4 py-3 text-right">{formatQty(v.current_stock, v.base_unit)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                      {formatQty(v.available_stock, v.base_unit)}
                    </td>
                    <td className="px-4 py-3">
                      {v.is_deleted ? (
                        <StatusBadge status="CANCELLED" />
                      ) : (
                        <StatusBadge status={v.status} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openDetails(v.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                          title="View stock & sales history"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {!v.is_deleted ? (
                          <>
                            <button
                              onClick={() => openEdit(v)}
                              className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50"
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(v)}
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                              title="Soft Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          isSuperAdmin && (
                            <button
                              onClick={() => handleRestore(v.id)}
                              className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50"
                              title="Restore"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <Pagination
              pagination={pagination}
              onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
            />
          </div>
        </div>
      )}

      {/* Add / Edit Vegetable Modal */}
      <Modal
        open={formModal}
        onClose={() => setFormModal(false)}
        title={editingId ? 'Edit Vegetable' : 'Add Vegetable'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Category *</label>
              <select
                required
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Unit *</label>
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              >
                <option value="KG">KG</option>
                <option value="GRAM">GRAM</option>
                <option value="PIECE">PIECE</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Pack Size *</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                required
                value={form.packSize}
                onChange={(e) => setForm({ ...form, packSize: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Selling Price (Rs.) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.sellingPrice}
                onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">SKU</label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Low Stock Alert
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={form.minStockThreshold}
                onChange={(e) => setForm({ ...form, minStockThreshold: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Upload Vegetable Image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-agro-50 file:text-agro-700 file:font-semibold"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFormModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-agro-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Vegetable'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Vegetable Details & Sales History Modal */}
      <Modal
        open={Boolean(detailVeg)}
        onClose={() => setDetailVeg(null)}
        title={detailVeg?.name || 'Vegetable Details'}
        maxWidth="max-w-2xl"
      >
        {detailVeg && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl">
              <div>
                <div className="text-xs text-slate-500">Current Stock</div>
                <div className="font-bold">
                  {formatQty(detailVeg.current_stock, detailVeg.base_unit)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Reserved</div>
                <div className="font-bold text-sky-700">
                  {formatQty(detailVeg.reserved_stock, detailVeg.base_unit)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Available</div>
                <div className="font-bold text-emerald-700">
                  {formatQty(detailVeg.available_stock, detailVeg.base_unit)}
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 mb-2">Recent Sales History</h4>
              {detailVeg.salesHistory?.length === 0 ? (
                <p className="text-xs text-slate-500">No sales recorded for this vegetable yet.</p>
              ) : (
                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Order #</th>
                        <th className="px-3 py-2">Customer</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailVeg.salesHistory.map((s) => (
                        <tr key={s.id}>
                          <td className="px-3 py-2 font-semibold">{s.order_number}</td>
                          <td className="px-3 py-2">{s.customer_name}</td>
                          <td className="px-3 py-2 text-right">{formatQty(s.quantity, s.unit)}</td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {formatCurrency(s.line_total)}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{formatDateTime(s.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleSoftDelete}
        title="Soft Delete Vegetable"
        message={`Soft-delete "${deleteTarget?.name}"? Records referenced by historical orders or stock movements cannot be deleted and should be deactivated instead.`}
        confirmText="Delete"
      />
    </div>
  );
}
