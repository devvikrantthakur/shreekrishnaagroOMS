import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit3, Trash2, RotateCcw } from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import StatusBadge from '../../components/common/StatusBadge';
import { LoadingSpinner, EmptyState } from '../../components/common/Feedback';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';

export default function CategoriesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', sortOrder: 0, status: 'ACTIVE' });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/categories', {
        params: { includeDeleted: includeDeleted ? 'true' : undefined },
      });
      setCategories(res.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [includeDeleted, toast]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', description: '', sortOrder: 0, status: 'ACTIVE' });
    setModalOpen(true);
  };

  const openEdit = (cat) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      description: cat.description || '',
      sortOrder: cat.sort_order || 0,
      status: cat.status,
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/admin/categories/${editing.id}`, form);
        toast.success('Category updated.');
      } else {
        await api.post('/admin/categories', form);
        toast.success('Category created.');
      }
      setModalOpen(false);
      await loadCategories();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/admin/categories/${deleteTarget.id}`);
      toast.success('Category soft-deleted.');
      setDeleteTarget(null);
      await loadCategories();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeleteTarget(null);
    }
  };

  const handleRestore = async (id) => {
    try {
      await api.post(`/admin/categories/${id}/restore`);
      toast.success('Category restored.');
      await loadCategories();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vegetable Categories</h1>
          <p className="text-sm text-slate-500">Organize vegetables into storefront categories</p>
        </div>
        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)}
                className="accent-agro-600"
              />
              Show Deleted
            </label>
          )}
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-agro-600 hover:bg-agro-700 text-white text-sm font-semibold"
          >
            <Plus className="w-4 h-4" /> Add Category
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading categories..." />
      ) : categories.length === 0 ? (
        <EmptyState title="No categories found" />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Vegetables</th>
                <th className="px-4 py-3 text-right">Order</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map((cat) => (
                <tr key={cat.id} className={cat.is_deleted ? 'bg-red-50/40' : ''}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{cat.name}</td>
                  <td className="px-4 py-3 text-slate-600">{cat.description || '-'}</td>
                  <td className="px-4 py-3 text-right font-medium">{cat.vegetable_count}</td>
                  <td className="px-4 py-3 text-right">{cat.sort_order}</td>
                  <td className="px-4 py-3">
                    {cat.is_deleted ? <StatusBadge status="CANCELLED" /> : <StatusBadge status={cat.status} />}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      {!cat.is_deleted ? (
                        <>
                          <button onClick={() => openEdit(cat)} className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteTarget(cat)} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        isSuperAdmin && (
                          <button onClick={() => handleRestore(cat.id)} className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50">
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
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Category' : 'Add Category'}>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Category Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
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
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-sm">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-agro-600 text-white text-sm font-semibold">
              Save
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Soft Delete Category"
        message={`Soft-delete category "${deleteTarget?.name}"?`}
        confirmText="Delete"
      />
    </div>
  );
}
