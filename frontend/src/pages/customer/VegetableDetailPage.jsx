import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Leaf, CheckCircle2 } from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatQty, resolveImageUrl } from '../../utils/formatters';
import { LoadingSpinner } from '../../components/common/Feedback';

export default function VegetableDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { setCartItem, getItemInCart } = useCart();
  const toast = useToast();
  const navigate = useNavigate();

  const [veg, setVeg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState('KG');
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await api.get(`/catalog/vegetables/${id}`);
        const data = res.data.data;
        setVeg(data);
        const inCart = getItemInCart(data.id);
        if (inCart) {
          setUnit(inCart.unit);
          setQuantity(Number(inCart.quantity));
        } else {
          setUnit(data.unit);
          setQuantity(Number(data.pack_size || 1));
        }
      } catch (err) {
        toast.error(getErrorMessage(err, 'Vegetable not found'));
        navigate('/');
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const cartItemForVeg = veg ? getItemInCart(veg.id) : null;
  useEffect(() => {
    if (cartItemForVeg) {
      setUnit(cartItemForVeg.unit);
      setQuantity(Number(cartItemForVeg.quantity));
    }
  }, [cartItemForVeg]);

  if (loading || !veg) return <LoadingSpinner label="Loading vegetable details..." />;

  const allowedUnits = veg.base_unit === 'PIECE' ? ['PIECE'] : ['KG', 'GRAM'];
  const quickPresets =
    unit === 'GRAM' ? [250, 500, 750] : unit === 'PIECE' ? [1, 2, 5, 10] : [0.5, 1, 2, 5];

  const handleAddToCart = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please login to add items to your cart.');
      navigate('/login');
      return;
    }
    if (Number(quantity) <= 0) {
      toast.error('Quantity must be greater than zero.');
      return;
    }
    setSaving(true);
    try {
      await setCartItem(veg.id, Number(quantity), unit);
      toast.success(`${veg.name} updated in cart.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-agro-700 dark:hover:text-agro-400"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Vegetables
      </Link>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-2 transition-colors">
        <div className="bg-agro-50/50 dark:bg-slate-800/50 p-6 flex items-center justify-center">
          {veg.image_url ? (
            <img
              src={resolveImageUrl(veg.image_url)}
              alt={veg.name}
              className="w-full max-h-80 object-contain rounded-2xl"
            />
          ) : (
            <Leaf className="w-24 h-24 text-agro-300 dark:text-agro-500" />
          )}
        </div>

        <div className="p-6 sm:p-8 flex flex-col">
          <span className="text-xs font-bold uppercase tracking-wider text-agro-600 dark:text-agro-400">
            {veg.category_name}
          </span>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{veg.name}</h1>
          {veg.sku && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">SKU: {veg.sku}</div>}

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(veg.selling_price)}
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              per {formatQty(veg.pack_size, veg.unit)}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-white bg-emerald-50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 px-3 py-1.5 rounded-lg w-fit">
            <CheckCircle2 className="w-4 h-4" />
            Available Stock: {formatQty(veg.available_stock, veg.base_unit)}
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300 mt-4 leading-relaxed">
            {veg.description || 'Farm-fresh produce sourced directly from trusted growers.'}
          </p>

          <form onSubmit={handleAddToCart} className="mt-auto pt-5 space-y-4">
            <div>
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Quick Select</span>
              <div className="flex flex-wrap gap-2">
                {quickPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQuantity(preset)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                      Number(quantity) === preset
                        ? 'bg-agro-600 text-white border-agro-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-agro-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {preset} {unit}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Quantity</label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-agro-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Unit</label>
                <select
                  value={unit}
                  onChange={(e) => {
                    const nextUnit = e.target.value;
                    const q = Number(quantity);
                    if (Number.isFinite(q) && q > 0) {
                      if (unit === 'KG' && nextUnit === 'GRAM') {
                        setQuantity(Number((q * 1000).toFixed(3)));
                      } else if (unit === 'GRAM' && nextUnit === 'KG') {
                        setQuantity(Number((q / 1000).toFixed(3)));
                      }
                    }
                    setUnit(nextUnit);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-agro-500 outline-none"
                >
                  {allowedUnits.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-agro-600 hover:bg-agro-700 text-white font-semibold text-sm shadow-sm transition disabled:opacity-60"
            >
              <ShoppingCart className="w-4 h-4" />
              {saving ? 'Updating Cart...' : 'Add / Update Cart'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
