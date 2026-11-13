import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Trash2,
  Plus,
  Minus,
  MapPin,
  CheckCircle2,
  ShoppingBag,
  ArrowRight,
  LocateFixed,
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatQty, resolveImageUrl } from '../../utils/formatters';
import { EmptyState, LoadingSpinner } from '../../components/common/Feedback';
import AddressModal from '../../components/common/AddressModal';

export default function CheckoutPage() {
  const { user } = useAuth();
  const { cart, cartLoading, setCartItem, removeCartItem, fetchCart } = useCart();
  const toast = useToast();
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [notes, setNotes] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  const [addrModalOpen, setAddrModalOpen] = useState(false);
  const [autoDetectLocation, setAutoDetectLocation] = useState(false);

  const loadAddresses = async () => {
    try {
      const res = await api.get('/auth/addresses');
      const list = res.data.data || [];
      setAddresses(list);
      if (list.length > 0 && !selectedAddressId) {
        const def = list.find((a) => a.is_default) || list[0];
        setSelectedAddressId(String(def.id));
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  const handleAddressSaved = async (savedAddr) => {
    await loadAddresses();
    if (savedAddr?.id) {
      setSelectedAddressId(String(savedAddr.id));
    }
  };

  const handleStep = async (item, deltaSign) => {
    const step = item.unit === 'GRAM' ? 250 : Number(item.pack_size || 1);
    const next = Math.max(0, Number((Number(item.quantity) + deltaSign * step).toFixed(3)));
    try {
      await setCartItem(item.vegetable_id, next, item.unit);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      toast.error('Please select or add a delivery address.');
      return;
    }
    setPlacingOrder(true);
    try {
      const res = await api.post('/orders', {
        addressId: selectedAddressId,
        notes: notes || null,
      });
      setConfirmedOrder(res.data.data);
      await fetchCart();
      toast.success('Order placed successfully!');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPlacingOrder(false);
    }
  };

  if (confirmedOrder) {
    return (
      <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-agro-200 dark:border-slate-800 shadow-sm p-8 text-center space-y-4 transition">
        <div className="w-16 h-16 rounded-full bg-agro-100 dark:bg-agro-950 text-agro-600 dark:text-agro-400 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Order Confirmed!</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Your order has been placed with Shree Krishna Agro Pvt. Ltd.
        </p>
        <div className="bg-agro-50 dark:bg-agro-950/60 border border-agro-200 dark:border-agro-900 rounded-2xl p-4">
          <div className="text-xs text-agro-700 dark:text-agro-400 font-semibold uppercase">Order Number</div>
          <div className="text-xl font-bold text-agro-900 dark:text-agro-200 mt-0.5">{confirmedOrder.order_number}</div>
          <div className="text-sm text-slate-700 dark:text-slate-300 mt-2">
            Total Amount: <strong>{formatCurrency(confirmedOrder.total_amount)}</strong>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            to={`/orders/${confirmedOrder.id}`}
            className="px-5 py-2.5 rounded-xl bg-agro-600 hover:bg-agro-700 text-white text-sm font-semibold"
          >
            View Order Details
          </Link>
          <Link
            to="/"
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  if (cartLoading) return <LoadingSpinner label="Loading cart..." />;

  if (cart.items.length === 0) {
    return (
      <EmptyState
        title="Your vegetable cart is empty"
        description="Browse fresh farm produce and tap ADD on any vegetable."
        action={
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-agro-600 text-white text-sm font-semibold hover:bg-agro-700"
          >
            <ShoppingBag className="w-4 h-4" /> Browse Vegetables
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      <div className="lg:col-span-2 space-y-4 min-w-0">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 transition">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-3 sm:mb-4">
            Cart Items ({cart.items.length})
          </h2>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {cart.items.map((item) => (
              <div
                key={item.id}
                className="py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-agro-50 dark:bg-slate-800 overflow-hidden shrink-0">
                    {item.image_url && (
                      <img
                        src={resolveImageUrl(item.image_url)}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/vegetables/${item.vegetable_id}`}
                      className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100 hover:text-agro-700 dark:hover:text-agro-400 truncate block"
                    >
                      {item.name}
                    </Link>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {formatCurrency(item.base_unit_price)} / {item.base_unit} •{' '}
                      {formatQty(item.base_quantity, item.base_unit)}
                    </div>
                  </div>
                  <button
                    onClick={() => removeCartItem(item.vegetable_id)}
                    className="sm:hidden p-2 text-slate-400 hover:text-red-600 rounded-lg shrink-0"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 pl-[4.25rem] sm:pl-0">
                  <div className="flex items-center border border-agro-600 bg-agro-50/40 dark:bg-agro-950/40 rounded-xl overflow-hidden">
                    <button
                      onClick={() => handleStep(item, -1)}
                      className="p-2 hover:bg-agro-100 dark:hover:bg-slate-700 text-agro-700 dark:text-white"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {formatQty(item.quantity, item.unit)}
                    </span>
                    <button
                      onClick={() => handleStep(item, 1)}
                      className="p-2 hover:bg-agro-100 dark:hover:bg-slate-700 text-agro-700 dark:text-white"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="sm:w-24 text-right font-bold text-slate-900 dark:text-white text-sm">
                    {formatCurrency(item.line_total)}
                  </div>

                  <button
                    onClick={() => removeCartItem(item.vegetable_id)}
                    className="hidden sm:inline-flex p-2 text-slate-400 hover:text-red-600 rounded-lg"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Delivery Address Selection */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 transition">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-agro-600 shrink-0" /> Delivery Address
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setAutoDetectLocation(true);
                  setAddrModalOpen(true);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-white bg-emerald-50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 hover:bg-emerald-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg"
              >
                <LocateFixed className="w-3.5 h-3.5" /> Current Location
              </button>
              <button
                type="button"
                onClick={() => {
                  setAutoDetectLocation(false);
                  setAddrModalOpen(true);
                }}
                className="text-xs font-semibold text-agro-700 dark:text-agro-400 bg-agro-50 dark:bg-agro-950/60 hover:bg-agro-100 px-3 py-1.5 rounded-lg"
              >
                + Add Address
              </button>
            </div>
          </div>

          {addresses.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400 py-4">
              No saved addresses found. Click "+ Add New Address" to continue.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {addresses.map((addr) => (
                <label
                  key={addr.id}
                  className={`cursor-pointer p-4 rounded-xl border-2 transition ${
                    String(selectedAddressId) === String(addr.id)
                      ? 'border-agro-600 bg-agro-50/40 dark:bg-agro-950/40'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-agro-700 dark:text-agro-400">{addr.label}</span>
                    <input
                      type="radio"
                      name="address"
                      checked={String(selectedAddressId) === String(addr.id)}
                      onChange={() => setSelectedAddressId(String(addr.id))}
                      className="accent-agro-600"
                    />
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-white text-sm mt-1">{addr.recipient_name}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    {addr.address_line1}
                    {addr.address_line2 ? `, ${addr.address_line2}` : ''}, {addr.city}, {addr.state} -{' '}
                    {addr.pincode}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Mobile: {addr.mobile}</div>
                  {addr.latitude !== null && addr.latitude !== undefined && addr.longitude !== null && (
                    <div className="text-[11px] text-agro-700 dark:text-agro-400 font-medium mt-1 flex items-center gap-1">
                      <LocateFixed className="w-3 h-3" /> GPS Location Attached
                    </div>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Order Summary */}
      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sticky top-20 sm:top-24 space-y-4 transition">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Order Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Items Subtotal</span>
              <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(cart.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Delivery Charges</span>
              <span className="text-agro-700 dark:text-agro-400 font-semibold">FREE</span>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800 pt-2 flex justify-between text-base font-bold text-slate-900 dark:text-white">
              <span>Total Payable</span>
              <span>{formatCurrency(cart.subtotal)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Delivery Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Morning delivery preferred, call on arrival..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-agro-500"
            />
          </div>

          <button
            onClick={handlePlaceOrder}
            disabled={placingOrder || !selectedAddressId}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-agro-600 hover:bg-agro-700 text-white font-semibold text-sm shadow-sm transition disabled:opacity-50"
          >
            {placingOrder ? 'Placing Order...' : 'Place Order'} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AddressModal
        open={addrModalOpen}
        onClose={() => setAddrModalOpen(false)}
        onSaved={handleAddressSaved}
        user={user}
        defaultIsDefault={true}
        autoDetectOnOpen={autoDetectLocation}
        title="Add Delivery Address"
      />
    </div>
  );
}
