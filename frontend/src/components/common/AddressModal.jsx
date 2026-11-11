import React, { useState, useEffect, useCallback } from 'react';
import { LocateFixed, Loader2, MapPin, CheckCircle2, ExternalLink } from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Modal from './Modal';

const EMPTY_FORM = {
  label: 'Home',
  recipientName: '',
  mobile: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: 'Maharashtra',
  pincode: '',
  latitude: null,
  longitude: null,
  isDefault: false,
};

export default function AddressModal({
  open,
  onClose,
  onSaved,
  user = null,
  initialAddress = null,
  defaultIsDefault = false,
  autoDetectOnOpen = false,
  endpointBase = '/auth/addresses',
  title = null,
}) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locationInfo, setLocationInfo] = useState('');

  const detectCurrentLocation = useCallback(
    async ({ saveImmediately = false } = {}) => {
      if (!navigator.geolocation) {
        toast.error('Geolocation is not supported by your browser.');
        return;
      }
      setDetecting(true);
      setLocationInfo('Requesting GPS location permission...');

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          setLocationInfo('Fetching street address from coordinates...');
          try {
            const res = await api.get('/auth/reverse-geocode', {
              params: { lat: latitude, lng: longitude },
            });
            const geo = res.data.data || {};
            const updatedForm = {
              ...form,
              recipientName: form.recipientName || user?.full_name || '',
              mobile: form.mobile || user?.mobile || '',
              addressLine1: geo.addressLine1 || form.addressLine1,
              addressLine2: geo.addressLine2 || form.addressLine2,
              city: geo.city || form.city,
              state: geo.state || form.state || 'Maharashtra',
              pincode: geo.pincode || form.pincode,
              latitude: geo.latitude ?? Number(latitude.toFixed(7)),
              longitude: geo.longitude ?? Number(longitude.toFixed(7)),
            };
            setForm(updatedForm);

            if (geo.fallback) {
              setLocationInfo(
                `GPS captured (${latitude.toFixed(5)}, ${longitude.toFixed(5)}). Please complete street/city details.`
              );
              toast.success('GPS coordinates captured. Please verify address details.');
            } else {
              setLocationInfo(geo.formattedAddress || 'Current location detected!');
              toast.success('Current location detected and address filled!');

              if (
                saveImmediately &&
                updatedForm.recipientName &&
                updatedForm.mobile &&
                updatedForm.addressLine1 &&
                updatedForm.city &&
                updatedForm.state &&
                updatedForm.pincode
              ) {
                setSaving(true);
                try {
                  const savedRes = initialAddress
                    ? await api.put(`${endpointBase}/${initialAddress.id}`, updatedForm)
                    : await api.post(endpointBase, updatedForm);
                  toast.success('Current address saved!');
                  onSaved?.(savedRes.data.data);
                  onClose?.();
                } catch (saveErr) {
                  toast.error(getErrorMessage(saveErr));
                } finally {
                  setSaving(false);
                }
              }
            }
          } catch (err) {
            setForm((prev) => ({
              ...prev,
              recipientName: prev.recipientName || user?.full_name || '',
              mobile: prev.mobile || user?.mobile || '',
              latitude: Number(latitude.toFixed(7)),
              longitude: Number(longitude.toFixed(7)),
            }));
            setLocationInfo(`GPS captured (${latitude.toFixed(5)}, ${longitude.toFixed(5)}).`);
            toast.error(getErrorMessage(err, 'Could not resolve street address automatically.'));
          } finally {
            setDetecting(false);
          }
        },
        (geoErr) => {
          setDetecting(false);
          setLocationInfo('');
          if (geoErr.code === 1) {
            toast.error('Location permission denied. Please allow location access or enter address manually.');
          } else if (geoErr.code === 2) {
            toast.error('Location unavailable. Please check device GPS/network.');
          } else {
            toast.error('Location detection timed out. Please try again or enter manually.');
          }
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    },
    [form, user, initialAddress, endpointBase, onSaved, onClose, toast]
  );

  useEffect(() => {
    if (!open) return;
    setLocationInfo('');
    if (initialAddress) {
      setForm({
        label: initialAddress.label || 'Home',
        recipientName: initialAddress.recipient_name || '',
        mobile: initialAddress.mobile || '',
        addressLine1: initialAddress.address_line1 || '',
        addressLine2: initialAddress.address_line2 || '',
        city: initialAddress.city || '',
        state: initialAddress.state || 'Maharashtra',
        pincode: initialAddress.pincode || '',
        latitude: initialAddress.latitude ?? null,
        longitude: initialAddress.longitude ?? null,
        isDefault: Boolean(initialAddress.is_default),
      });
    } else {
      setForm({
        ...EMPTY_FORM,
        recipientName: user?.full_name || '',
        mobile: user?.mobile || '',
        isDefault: defaultIsDefault,
      });
    }
  }, [open, initialAddress, user, defaultIsDefault]);

  useEffect(() => {
    if (open && autoDetectOnOpen && !initialAddress) {
      detectCurrentLocation({ saveImmediately: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoDetectOnOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = initialAddress
        ? await api.put(`${endpointBase}/${initialAddress.id}`, form)
        : await api.post(endpointBase, form);
      toast.success(initialAddress ? 'Address updated.' : 'Address saved.');
      onSaved?.(res.data.data);
      onClose?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title || (initialAddress ? 'Edit Address' : 'Add Delivery Address')}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Detect Current Location Banner */}
        <div className="p-3 rounded-xl bg-agro-50 border border-agro-200 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-agro-900 font-medium flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-agro-600 shrink-0" />
              <span>Detect your current GPS location to auto-fill address</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={detecting || saving}
                onClick={() => detectCurrentLocation({ saveImmediately: false })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-agro-600 hover:bg-agro-700 text-white text-xs font-semibold shadow-sm disabled:opacity-60"
              >
                {detecting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Detecting...
                  </>
                ) : (
                  <>
                    <LocateFixed className="w-3.5 h-3.5" /> Detect Current Location
                  </>
                )}
              </button>
            </div>
          </div>

          {(locationInfo || (form.latitude !== null && form.longitude !== null)) && (
            <div className="text-[11px] text-agro-800 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-agro-200/70">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-agro-600 shrink-0" />
                {locationInfo || `Saved GPS: ${Number(form.latitude).toFixed(5)}, ${Number(form.longitude).toFixed(5)}`}
              </span>
              {form.latitude !== null && form.longitude !== null && (
                <a
                  href={`https://maps.google.com/?q=${form.latitude},${form.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-agro-700 font-semibold hover:underline"
                >
                  View Map <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Label</label>
            <input
              type="text"
              required
              placeholder="Home / Shop / Hotel"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Recipient Name</label>
            <input
              type="text"
              required
              placeholder="Recipient Name"
              value={form.recipientName}
              onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Mobile</label>
          <input
            type="tel"
            required
            placeholder="Mobile Number"
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Address Line 1</label>
          <input
            type="text"
            required
            placeholder="House / Shop No, Street, Area"
            value={form.addressLine1}
            onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Address Line 2 (Optional)</label>
          <input
            type="text"
            placeholder="Landmark, Locality"
            value={form.addressLine2}
            onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">City</label>
            <input
              type="text"
              required
              placeholder="City"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">State</label>
            <input
              type="text"
              required
              placeholder="State"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Pincode</label>
            <input
              type="text"
              required
              placeholder="Pincode"
              value={form.pincode}
              onChange={(e) => setForm({ ...form, pincode: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 pt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            className="accent-agro-600"
          />
          Set as default delivery address
        </label>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-medium"
          >
            Cancel
          </button>
          {!initialAddress && (
            <button
              type="button"
              disabled={detecting || saving}
              onClick={() => detectCurrentLocation({ saveImmediately: true })}
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold disabled:opacity-50"
            >
              Detect & Save Now
            </button>
          )}
          <button
            type="submit"
            disabled={saving || detecting}
            className="px-4 py-2 rounded-xl bg-agro-600 hover:bg-agro-700 text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Address'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
