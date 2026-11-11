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

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    search: '',
    role: '',
    status: '',
    includeDeleted: false,
    page: 1,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    password: '',
    role: 'CUSTOMER',
    status: 'ACTIVE',
  });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users', {
        params: {
          page: filters.page,
          limit: 15,
          search: filters.search || undefined,
          role: filters.role || undefined,
          status: filters.status || undefined,
          includeDeleted: filters.includeDeleted ? 'true' : undefined,
        },
      });
      setUsers(res.data.data.items || []);
      setPagination(res.data.data.pagination);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      fullName: '',
      email: '',
      mobile: '',
      password: '',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    });
    setModalOpen(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      fullName: u.full_name,
      email: u.email,
      mobile: u.mobile,
      password: '',
      role: u.role,
      status: u.status,
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;

      if (editing) {
        await api.put(`/admin/users/${editing.id}`, payload);
        toast.success('User updated.');
      } else {
        await api.post('/admin/users', payload);
        toast.success('User created.');
      }
      setModalOpen(false);
      await loadUsers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/admin/users/${deleteTarget.id}`);
      toast.success('User soft-deleted.');
      setDeleteTarget(null);
      await loadUsers();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeleteTarget(null);
    }
  };

  const handleRestore = async (id) => {
    try {
      await api.post(`/admin/users/${id}/restore`);
      toast.success('User restored.');
      await loadUsers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User & Customer Management</h1>
          <p className="text-sm text-slate-500">
            Manage customer accounts, addresses, order history & admin roles
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-agro-600 hover:bg-agro-700 text-white text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Create User
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
            placeholder="Search name, email or mobile..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
        </div>
        <select
          value={filters.role}
          onChange={(e) => setFilters({ ...filters, role: e.target.value, page: 1 })}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
        >
          <option value="">All Roles</option>
          <option value="CUSTOMER">CUSTOMER</option>
          <option value="ADMIN">ADMIN</option>
          {isSuperAdmin && <option value="SUPER_ADMIN">SUPER_ADMIN</option>}
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
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={filters.includeDeleted}
              onChange={(e) => setFilters({ ...filters, includeDeleted: e.target.checked, page: 1 })}
              className="accent-agro-600"
            />
            Show Deleted
          </label>
        )}
      </div>

      {loading ? (
        <LoadingSpinner label="Loading users..." />
      ) : users.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3 text-right">Orders</th>
                  <th className="px-4 py-3 text-right">Order Value</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className={u.is_deleted ? 'bg-red-50/40' : ''}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{u.full_name}</div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.mobile}</td>
                    <td className="px-4 py-3"><StatusBadge status={u.role} /></td>
                    <td className="px-4 py-3 text-right">{u.order_count}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatCurrency(u.total_order_value)}
                    </td>
                    <td className="px-4 py-3">
                      {u.is_deleted ? <StatusBadge status="CANCELLED" /> : <StatusBadge status={u.status} />}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1.5">
                        <Link
                          to={`/admin/users/${u.id}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                          title="View details & addresses"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        {!u.is_deleted ? (
                          <>
                            <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteTarget(u)} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          isSuperAdmin && (
                            <button onClick={() => handleRestore(u.id)} className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50">
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
            <Pagination pagination={pagination} onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit User' : 'Create User'}>
        <form onSubmit={handleSave} className="space-y-3">
          <input
            type="text"
            required
            placeholder="Full Name *"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="email"
              required
              placeholder="Email *"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
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
          <input
            type="password"
            required={!editing}
            minLength={6}
            placeholder={editing ? 'New Password (leave blank to keep current)' : 'Password (min 6 chars) *'}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.role}
              disabled={!isSuperAdmin}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm disabled:bg-slate-50"
            >
              <option value="CUSTOMER">CUSTOMER</option>
              {isSuperAdmin && <option value="ADMIN">ADMIN</option>}
              {isSuperAdmin && <option value="SUPER_ADMIN">SUPER_ADMIN</option>}
            </select>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-sm">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-agro-600 text-white text-sm font-semibold">
              Save User
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Soft Delete User"
        message={`Soft-delete user "${deleteTarget?.full_name}"? Accounts with historical orders cannot be deleted and should be deactivated instead.`}
        confirmText="Delete"
      />
    </div>
  );
}
