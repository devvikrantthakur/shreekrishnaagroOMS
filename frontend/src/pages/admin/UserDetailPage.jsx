import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import StatusBadge from '../../components/common/StatusBadge';
import { LoadingSpinner } from '../../components/common/Feedback';
import Modal from '../../components/common/Modal';

export default function UserDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addrModal, setAddrModal] = useState(false);
  const [addrForm, setAddrForm] = useState({
    label: 'Shop',
    recipientName: '',
    mobile: '',
    addressLine1: '',
    city: '',
    state: 'Maharashtra',
    pincode: '',
  });

  const loadUser = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/users/${id}`);
      setUser(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const handleAddAddress = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/admin/users/${id}/addresses`, addrForm);
      toast.success('Address added for customer.');
      setAddrModal(false);
      await loadUser();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDeleteAddress = async (addressId) => {
    try {
      await api.delete(`/admin/users/${id}/addresses/${addressId}`);
      toast.success('Address deleted.');
      await loadUser();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading || !user) return <LoadingSpinner label="Loading user details..." />;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white mb-1">
          <ArrowLeft className="w-4 h-4" /> Back to Users
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{user.full_name}</h1>
          <StatusBadge status={user.role} />
          <StatusBadge status={user.status} />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {user.email} • {user.mobile}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900">Saved Addresses ({user.addresses.length})</h2>
            <button
              onClick={() => {
                setAddrForm({
                  label: 'Home',
                  recipientName: user.full_name,
                  mobile: user.mobile,
                  addressLine1: '',
                  city: '',
                  state: 'Maharashtra',
                  pincode: '',
                });
                setAddrModal(true);
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-agro-50 text-agro-700 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Add Address
            </button>
          </div>
          <div className="space-y-3">
            {user.addresses.map((a) => (
              <div key={a.id} className="p-3 rounded-xl border border-slate-200 text-xs flex justify-between items-start">
                <div>
                  <div className="font-bold text-agro-700">{a.label} — {a.recipient_name}</div>
                  <div className="text-slate-600 mt-0.5">
                    {a.address_line1}, {a.city}, {a.state} - {a.pincode}
                  </div>
                  <div className="text-slate-400 mt-0.5">Mobile: {a.mobile}</div>
                </div>
                <button onClick={() => handleDeleteAddress(a.id)} className="text-red-500 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 font-bold">Order History ({user.orders.length})</div>
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Order #</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {user.orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2.5 font-semibold">
                    <Link to={`/admin/orders/${o.id}`} className="text-agro-700 hover:underline">
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{formatDateTime(o.created_at)}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(o.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={addrModal} onClose={() => setAddrModal(false)} title="Add Customer Address">
        <form onSubmit={handleAddAddress} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="text" required placeholder="Label" value={addrForm.label} onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
            <input type="text" required placeholder="Recipient" value={addrForm.recipientName} onChange={(e) => setAddrForm({ ...addrForm, recipientName: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
          </div>
          <input type="tel" required placeholder="Mobile" value={addrForm.mobile} onChange={(e) => setAddrForm({ ...addrForm, mobile: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
          <input type="text" required placeholder="Address Line 1" value={addrForm.addressLine1} onChange={(e) => setAddrForm({ ...addrForm, addressLine1: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
          <div className="grid grid-cols-3 gap-3">
            <input type="text" required placeholder="City" value={addrForm.city} onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
            <input type="text" required placeholder="State" value={addrForm.state} onChange={(e) => setAddrForm({ ...addrForm, state: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
            <input type="text" required placeholder="Pincode" value={addrForm.pincode} onChange={(e) => setAddrForm({ ...addrForm, pincode: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAddrModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700 text-sm font-medium transition">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-agro-600 text-white text-sm font-semibold">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
