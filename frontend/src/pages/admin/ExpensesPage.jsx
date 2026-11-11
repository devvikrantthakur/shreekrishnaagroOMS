import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit3, Trash2, RotateCcw } from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import Pagination from '../../components/common/Pagination';
import { LoadingSpinner, EmptyState } from '../../components/common/Feedback';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';

const CATEGORIES = ['Transportation', 'Labour', 'Rent', 'Packaging', 'Electricity', 'Maintenance', 'Other'];

export default function ExpensesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [expenses, setExpenses] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    category: '',
    dateFrom: '',
    dateTo: '',
    includeDeleted: false,
    page: 1,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: '',
    category: 'Transportation',
    amount: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'CASH',
    remarks: '',
  });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/expenses', {
        params: {
          page: filters.page,
          limit: 15,
          category: filters.category || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          includeDeleted: filters.includeDeleted ? 'true' : undefined,
        },
      });
      setExpenses(res.data.data.items || []);
      setPagination(res.data.data.pagination);
      setTotalAmount(res.data.data.totalAmount || 0);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      title: '',
      category: 'Transportation',
      amount: '',
      expenseDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'CASH',
      remarks: '',
    });
    setModalOpen(true);
  };

  const openEdit = (exp) => {
    setEditing(exp);
    setForm({
      title: exp.title,
      category: exp.category,
      amount: String(exp.amount),
      expenseDate: String(exp.expense_date).slice(0, 10),
      paymentMethod: exp.payment_method,
      remarks: exp.remarks || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/admin/expenses/${editing.id}`, form);
        toast.success('Expense updated.');
      } else {
        await api.post('/admin/expenses', form);
        toast.success('Expense added.');
      }
      setModalOpen(false);
      await loadExpenses();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/admin/expenses/${deleteTarget.id}`);
      toast.success('Expense soft-deleted.');
      setDeleteTarget(null);
      await loadExpenses();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleRestore = async (id) => {
    try {
      await api.post(`/admin/expenses/${id}/restore`);
      toast.success('Expense restored.');
      await loadExpenses();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expense Management</h1>
          <p className="text-sm text-slate-500">
            Filtered Total: <strong className="text-slate-900">{formatCurrency(totalAmount)}</strong>
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-agro-600 hover:bg-agro-700 text-white text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value, page: 1 })}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => setFilters({ ...filters, dateTo: e.target.value, page: 1 })}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
        />
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
        <LoadingSpinner label="Loading expenses..." />
      ) : expenses.length === 0 ? (
        <EmptyState title="No expenses recorded" />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Remarks</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((exp) => (
                  <tr key={exp.id} className={exp.is_deleted ? 'bg-red-50/40' : ''}>
                    <td className="px-4 py-3 text-slate-600">{formatDate(exp.expense_date)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{exp.title}</td>
                    <td className="px-4 py-3">{exp.category}</td>
                    <td className="px-4 py-3">{exp.payment_method}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{exp.remarks || '-'}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(exp.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1.5">
                        {!exp.is_deleted ? (
                          <>
                            <button onClick={() => openEdit(exp)} className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteTarget(exp)} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          isSuperAdmin && (
                            <button onClick={() => handleRestore(exp.id)} className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Expense' : 'Add Expense'}>
        <form onSubmit={handleSave} className="space-y-3">
          <input
            type="text"
            required
            placeholder="Expense Title *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="Amount (Rs.) *"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              required
              value={form.expenseDate}
              onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
            <select
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            >
              <option value="CASH">CASH</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">BANK_TRANSFER</option>
            </select>
          </div>
          <textarea
            rows={2}
            placeholder="Remarks"
            value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-sm">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-agro-600 text-white text-sm font-semibold">
              Save Expense
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Soft Delete Expense"
        message={`Soft-delete expense "${deleteTarget?.title}"?`}
        confirmText="Delete"
      />
    </div>
  );
}
