import React, { useState, useEffect, useCallback } from 'react';
import { User, MapPin, Plus, Trash2, KeyRound, LocateFixed, Edit3, ExternalLink } from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import AddressModal from '../../components/common/AddressModal';

export default function CustomerProfilePage() {
  const { user, refreshProfile } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState({ fullName: '', email: '', mobile: '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [addresses, setAddresses] = useState([]);
  const [addrModal, setAddrModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [autoDetectLocation, setAutoDetectLocation] = useState(false);

  const loadAddresses = useCallback(async () => {
    try {
      const res = await api.get('/auth/addresses');
      setAddresses(res.data.data || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (user) {
      setProfile({
        fullName: user.full_name || '',
        email: user.email || '',
        mobile: user.mobile || '',
      });
    }
    loadAddresses();
  }, [user, loadAddresses]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      await api.put('/auth/me', profile);
      await refreshProfile();
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    try {
      await api.put('/auth/change-password', passwords);
      setPasswords({ currentPassword: '', newPassword: '' });
      toast.success('Password changed successfully.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDeleteAddress = async (addressId) => {
    try {
      await api.delete(`/auth/addresses/${addressId}`);
      await loadAddresses();
      toast.success('Address deleted.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleSetDefault = async (addressId) => {
    try {
      await api.put(`/auth/addresses/${addressId}`, { isDefault: true });
      await loadAddresses();
      toast.success('Default address updated.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">My Profile &amp; Addresses</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <User className="w-5 h-5 text-agro-600" /> Personal Details
          </h2>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={profile.fullName}
              onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
            <input
              type="email"
              required
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Mobile</label>
            <input
              type="tel"
              required
              value={profile.mobile}
              onChange={(e) => setProfile({ ...profile, mobile: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-agro-600 hover:bg-agro-700 text-white text-sm font-semibold"
          >
            Save Profile
          </button>
        </form>

        <form onSubmit={handleChangePassword} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-agro-600" /> Change Password
          </h2>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Current Password</label>
            <input
              type="password"
              required
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">New Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold"
          >
            Update Password
          </button>
        </form>
      </div>

      {/* Saved Addresses */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-agro-600" /> Saved Delivery Addresses
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingAddress(null);
                setAutoDetectLocation(true);
                setAddrModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100"
            >
              <LocateFixed className="w-4 h-4" /> Use Current Location
            </button>
            <button
              onClick={() => {
                setEditingAddress(null);
                setAutoDetectLocation(false);
                setAddrModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-agro-600 text-white text-xs font-semibold hover:bg-agro-700"
            >
              <Plus className="w-4 h-4" /> Add Address
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {addresses.map((addr) => (
            <div key={addr.id} className="p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-agro-700">{addr.label}</span>
                  {addr.is_default === 1 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-agro-100 text-agro-800">
                      DEFAULT
                    </span>
                  )}
                </div>
                <div className="font-semibold text-slate-900 text-sm mt-1">{addr.recipient_name}</div>
                <div className="text-xs text-slate-600 mt-1">
                  {addr.address_line1}
                  {addr.address_line2 ? `, ${addr.address_line2}` : ''}, {addr.city}, {addr.state} -{' '}
                  {addr.pincode}
                </div>
                <div className="text-xs text-slate-500 mt-1">Mobile: {addr.mobile}</div>
                {addr.latitude !== null && addr.latitude !== undefined && addr.longitude !== null && (
                  <a
                    href={`https://maps.google.com/?q=${addr.latitude},${addr.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-agro-700 hover:underline mt-1.5"
                  >
                    <LocateFixed className="w-3 h-3" /> GPS Saved ({Number(addr.latitude).toFixed(4)},{' '}
                    {Number(addr.longitude).toFixed(4)}) <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                {addr.is_default !== 1 ? (
                  <button
                    onClick={() => handleSetDefault(addr.id)}
                    className="text-xs font-semibold text-agro-700 hover:underline"
                  >
                    Set as Default
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setEditingAddress(addr);
                      setAutoDetectLocation(false);
                      setAddrModal(true);
                    }}
                    className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => handleDeleteAddress(addr.id)}
                    className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AddressModal
        open={addrModal}
        onClose={() => setAddrModal(false)}
        onSaved={loadAddresses}
        user={user}
        initialAddress={editingAddress}
        autoDetectOnOpen={autoDetectLocation}
      />
    </div>
  );
}
