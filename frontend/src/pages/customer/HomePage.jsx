import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Minus, Leaf, Sparkles } from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatQty, resolveImageUrl } from '../../utils/formatters';
import { LoadingSpinner, EmptyState } from '../../components/common/Feedback';
import Pagination from '../../components/common/Pagination';

export default function HomePage() {
  const { user } = useAuth();
  const { getItemInCart, setCartItem } = useCart();
  const toast = useToast();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [vegetables, setVegetables] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [page, setPage] = useState(1);
  const [busyVegId, setBusyVegId] = useState(null);

  const loadCategories = async () => {
    try {
      const res = await api.get('/catalog/categories');
      setCategories(res.data.data || []);
    } catch {
      // ignore
    }
  };

  const loadVegetables = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/catalog/vegetables', {
        params: {
          page,
          limit: 16,
          categoryId: selectedCategory || undefined,
          search: search || undefined,
          unit: unitFilter || undefined,
        },
      });
      setVegetables(res.data.data.items || []);
      setPagination(res.data.data.pagination);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load vegetables'));
    } finally {
      setLoading(false);
    }
  }, [page, selectedCategory, search, unitFilter, toast]);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadVegetables();
  }, [loadVegetables]);

  const handleQtyChange = async (veg, deltaSign) => {
    if (!user) {
      toast.error('Please login to add vegetables to your cart.');
      navigate('/login');
      return;
    }

    const inCart = getItemInCart(veg.id);
    const step = Number(veg.pack_size || 1);
    const currentQty = inCart ? Number(inCart.quantity) : 0;
    const unit = inCart ? inCart.unit : veg.unit;
    // If item in cart uses same unit as default, step by pack_size; if custom unit (e.g. GRAM), step by 100 or 1
    const effectiveStep =
      unit === veg.unit ? step : unit === 'GRAM' ? 250 : 1;

    const nextQty = Math.max(0, Number((currentQty + deltaSign * effectiveStep).toFixed(3)));

    setBusyVegId(veg.id);
    try {
      await setCartItem(veg.id, nextQty, unit);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyVegId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-agro-800 via-agro-700 to-emerald-600 text-white p-6 sm:p-8 shadow-md">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Direct from APMC & Partner Farms
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Farm-Fresh Vegetables Delivered Daily
          </h1>
          <p className="text-agro-100 text-sm sm:text-base mt-2">
            Order wholesale & household quantities in KG, Grams, or Pieces with live pricing and transparent invoicing.
          </p>
        </div>
        <Leaf className="hidden md:block w-36 h-36 text-white/10 absolute right-8 -bottom-4" />
      </section>

      {/* Search & Filters */}
      <section className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search tomato, potato, palak, coriander..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 focus:ring-2 focus:ring-agro-500 outline-none text-sm shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <select
            value={unitFilter}
            onChange={(e) => {
              setUnitFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-700 outline-none"
          >
            <option value="">All Units</option>
            <option value="KG">KG</option>
            <option value="GRAM">GRAM</option>
            <option value="PIECE">PIECE</option>
          </select>
        </div>
      </section>

      {/* Category Pills */}
      <section className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => {
            setSelectedCategory('');
            setPage(1);
          }}
          className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
            selectedCategory === ''
              ? 'bg-agro-600 text-white shadow-sm'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-agro-50'
          }`}
        >
          All Vegetables
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setSelectedCategory(String(cat.id));
              setPage(1);
            }}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
              selectedCategory === String(cat.id)
                ? 'bg-agro-600 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-agro-50'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </section>

      {/* Vegetable Grid */}
      {loading ? (
        <LoadingSpinner label="Fetching fresh vegetables..." />
      ) : vegetables.length === 0 ? (
        <EmptyState
          title="No vegetables match your search"
          description="Try clearing your category or search filter."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {vegetables.map((veg) => {
              const inCart = getItemInCart(veg.id);
              const isBusy = busyVegId === veg.id;
              return (
                <div
                  key={veg.id}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition flex flex-col overflow-hidden"
                >
                  <Link to={`/vegetables/${veg.id}`} className="block bg-agro-50/40 p-3">
                    <div className="aspect-[4/3] rounded-xl overflow-hidden bg-white flex items-center justify-center">
                      {veg.image_url ? (
                        <img
                          src={resolveImageUrl(veg.image_url)}
                          alt={veg.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Leaf className="w-12 h-12 text-agro-300" />
                      )}
                    </div>
                  </Link>

                  <div className="p-3.5 flex-1 flex flex-col">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-agro-600">
                      {veg.category_name}
                    </span>
                    <Link
                      to={`/vegetables/${veg.id}`}
                      className="font-semibold text-slate-900 text-sm sm:text-base mt-0.5 line-clamp-2 hover:text-agro-700"
                    >
                      {veg.name}
                    </Link>

                    <div className="text-xs text-slate-500 mt-1">
                      Pack: {formatQty(veg.pack_size, veg.unit)}
                    </div>

                    <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-base font-bold text-slate-900">
                          {formatCurrency(veg.selling_price)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          per {formatQty(veg.pack_size, veg.unit)}
                        </div>
                      </div>

                      {inCart ? (
                        <div className="flex items-center bg-agro-600 text-white rounded-xl overflow-hidden shadow-sm">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleQtyChange(veg, -1)}
                            className="p-2 hover:bg-agro-700 disabled:opacity-50"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2 text-xs font-bold min-w-[3.2rem] text-center">
                            {formatQty(inCart.quantity, inCart.unit)}
                          </span>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleQtyChange(veg, 1)}
                            className="p-2 hover:bg-agro-700 disabled:opacity-50"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleQtyChange(veg, 1)}
                          className="flex items-center gap-1 px-3.5 py-2 rounded-xl border-2 border-agro-600 text-agro-700 hover:bg-agro-600 hover:text-white text-xs font-bold transition disabled:opacity-50"
                        >
                          <Plus className="w-3.5 h-3.5" /> ADD
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
