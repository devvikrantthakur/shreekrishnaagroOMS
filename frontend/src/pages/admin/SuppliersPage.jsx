import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit3, Trash2, RotateCcw, Eye } from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../utils/formatters';
import StatusBadge from '../../components/common/StatusBadge';
import Pagination from '../../components/common/Pagination';
import { LoadingSpinner, EmptyState } from '../../components/common/Feedback';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';

export default function SuppliersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [suppliers, setSuppliers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    supplierName: '',
    contactPerson: '',
    mobile: '',
    email: '',
    address: '',
    openingBalance: '0',
    status: 'ACTIVE',
  });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/suppliers', {
        params: {
          page,
          limit: 15,
          search: search || undefined,
          includeDeleted: includeDeleted ? 'true' : undefined,
        },
      });
      setSuppliers(res.data.data.items || []);
      setPagination(res.data.data.pagination);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, includeDeleted, toast]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      supplierName: '',
      contactPerson: '',
      mobile: '',
      email: '',
      address: '',
      openingBalance: '0',
      status: 'ACTIVE',
    });
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      supplierName: s.supplier_name,
      contactPerson: s.contact_person || '',
      mobile: s.mobile,
      email: s.email || '',
      address: s.address || '',
      openingBalance: String(s.opening_balance || 0),
      status: s.status,
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/admin/suppliers/${editing.id}`, form);
        toast.success('Supplier updated.');
      } else {
        await api.post('/admin/suppliers', form);
        toast.success('Supplier created.');
      }
      setModalOpen(false);
      await loadSuppliers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/admin/suppliers/${deleteTarget.id}`);
      toast.success('Supplier soft-deleted.');
      setDeleteTarget(null);
      await loadSuppliers();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeleteTarget(null);
    }
  };

  const handleRestore = async (id) => {
    try {
      await api.post(`/admin/suppliers/${id}/restore`);
      toast.success('Supplier restored.');
      await loadSuppliers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Supplier Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage farm suppliers, purchase history & payables</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-agro-600 hover:bg-agro-700 text-white text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Add Supplier
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search supplier name, contact or mobile..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
        </div>
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
      </div>

      {loading ? (
        <LoadingSpinner label="Loading suppliers..." />
      ) : suppliers.length === 0 ? (
        <EmptyState title="No suppliers found" />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3 text-right">Received Purchases</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Outstanding Payable</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <tr key={s.id} className={s.is_deleted ? 'bg-red-50/40' : ''}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{s.supplier_name}</div>
                      <div className="text-xs text-slate-400">{s.email || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{s.contact_person || '-'}</div>
                      <div className="text-xs text-slate-500">{s.mobile}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(s.total_purchased_received)}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700">
                      {formatCurrency(s.total_paid)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">
                      {formatCurrency(s.outstanding_payable)}
                    </td>
                    <td className="px-4 py-3">
                      {s.is_deleted ? <StatusBadge status="CANCELLED" /> : <StatusBadge status={s.status} />}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1.5">
                        <Link
                          to={`/admin/suppliers/${s.id}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                          title="View ledger & payments"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        {!s.is_deleted ? (
                          <>
                            <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteTarget(s)} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          isSuperAdmin && (
                            <button onClick={() => handleRestore(s.id)} className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50">
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
            <Pagination pagination={pagination} onPageChange={setPage} />
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Supplier' : 'Add Supplier'}>
        <form onSubmit={handleSave} className="space-y-3">
          <input
            type="text"
            required
            placeholder="Supplier Name *"
            value={form.supplierName}
            onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Contact Person"
              value={form.contactPerson}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
            <input
              type="tel"
              required
              placeholder="Mobile *"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Opening Balance"
              value={form.openingBalance}
              onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <textarea
            rows={2}
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700 text-sm font-medium transition">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-agro-600 text-white text-sm font-semibold">
              Save Supplier
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Soft Delete Supplier"
        message={`Soft-delete supplier "${deleteTarget?.supplier_name}"? Suppliers with historical purchases cannot be deleted.`}
        confirmText="Delete"
      />
    </div>
  );
}
