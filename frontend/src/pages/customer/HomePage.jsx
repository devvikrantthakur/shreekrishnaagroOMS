import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Minus, Leaf, Sparkles, X, Truck } from 'lucide-react';
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

  const unitOptions = [
    { value: '', label: 'All' },
    { value: 'KG', label: 'KG' },
    { value: 'GRAM', label: 'Grams' },
    { value: 'PIECE', label: 'Pieces' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Compact Quick-Commerce Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-agro-800 via-agro-700 to-emerald-600 text-white p-4 sm:p-7 shadow-sm">
        <div className="max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-[11px] sm:text-xs font-semibold mb-2">
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Direct APMC &amp; Partner Farms
          </div>
          <h1 className="text-lg sm:text-3xl font-bold tracking-tight leading-snug">
            Fresh Farm Vegetables, Delivered Daily
          </h1>
          <p className="text-agro-100 text-xs sm:text-sm mt-1 sm:mt-2 leading-relaxed">
            Wholesale &amp; household packs in KG, Grams, or Pieces with live rates.
          </p>
          <div className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-100 bg-black/15 px-2.5 py-1 rounded-lg">
            <Truck className="w-3.5 h-3.5" /> Free morning delivery • Transparent GST invoicing
          </div>
        </div>
        <Leaf className="hidden sm:block w-32 h-32 text-white/10 absolute right-6 -bottom-4" />
      </section>

      {/* Sticky Search & Unit Filter Bar */}
      <section className="sticky top-14 sm:top-16 z-20 -mx-3 px-3 sm:mx-0 sm:px-0 py-2 bg-[#f5f8f5]/95 dark:bg-slate-950/95 backdrop-blur space-y-2.5 transition-colors">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search tomato, potato, palak, coriander..."
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-agro-500 focus:border-agro-500 outline-none text-sm shadow-xs transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {unitOptions.map((u) => (
              <button
                key={u.value || 'all'}
                type="button"
                onClick={() => {
                  setUnitFilter(u.value);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition shrink-0 ${
                  unitFilter === u.value
                    ? 'bg-slate-900 text-white dark:bg-agro-600 dark:text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <button
            onClick={() => {
              setSelectedCategory('');
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition shrink-0 ${
              selectedCategory === ''
                ? 'bg-agro-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-agro-50 dark:hover:bg-slate-800'
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
              className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition shrink-0 ${
                selectedCategory === String(cat.id)
                  ? 'bg-agro-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-agro-50 dark:hover:bg-slate-800'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </section>

      {/* Quick-Commerce Vegetable Grid */}
      {loading ? (
        <LoadingSpinner label="Fetching fresh vegetables..." />
      ) : vegetables.length === 0 ? (
        <EmptyState
          title="No vegetables match your search"
          description="Try clearing your category or search filter."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4">
            {vegetables.map((veg) => {
              const inCart = getItemInCart(veg.id);
              const isBusy = busyVegId === veg.id;
              return (
                <div
                  key={veg.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition flex flex-col overflow-hidden min-w-0"
                >
                  <Link
                    to={`/vegetables/${veg.id}`}
                    className="relative block bg-emerald-50/40 dark:bg-slate-800/60 p-2 sm:p-2.5"
                  >
                    <div className="aspect-[4/3] rounded-xl overflow-hidden bg-white dark:bg-slate-800 flex items-center justify-center">
                      {veg.image_url ? (
                        <img
                          src={resolveImageUrl(veg.image_url)}
                          alt={veg.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Leaf className="w-10 h-10 text-agro-300 dark:text-agro-500" />
                      )}
                    </div>
                    <span className="absolute bottom-3.5 left-3.5 px-2 py-0.5 rounded-md bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200/80 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 shadow-xs">
                      {formatQty(veg.pack_size, veg.unit)}
                    </span>
                  </Link>

                  <div className="p-2.5 sm:p-3 flex-1 flex flex-col min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-agro-600 dark:text-agro-400 truncate">
                      {veg.category_name}
                    </span>
                    <Link
                      to={`/vegetables/${veg.id}`}
                      className="font-semibold text-slate-900 dark:text-slate-100 text-xs sm:text-sm mt-0.5 line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem] leading-snug hover:text-agro-700 dark:hover:text-agro-400"
                    >
                      {veg.name}
                    </Link>

                    {/* Price & Action Section - Price is 100% visible on small mobile screens without truncation */}
                    <div className="mt-auto pt-2 flex flex-col justify-end min-w-0">
                      <div className="flex items-baseline justify-between gap-1 mb-1.5 min-w-0">
                        <div className="flex items-baseline gap-1 min-w-0">
                          <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                            {formatCurrency(veg.selling_price)}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-400 font-medium shrink-0">
                            /{formatQty(veg.pack_size, veg.unit)}
                          </span>
                        </div>
                      </div>

                      {inCart ? (
                        <div className="w-full flex items-center justify-between bg-agro-600 text-white rounded-xl overflow-hidden shadow-xs py-0.5 px-1 min-h-[34px]">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleQtyChange(veg, -1)}
                            className="p-1 sm:p-1.5 hover:bg-agro-700 active:scale-90 disabled:opacity-50 rounded-lg transition"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-1 text-[11px] sm:text-xs font-bold text-center truncate">
                            {formatQty(inCart.quantity, inCart.unit)}
                          </span>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleQtyChange(veg, 1)}
                            className="p-1 sm:p-1.5 hover:bg-agro-700 active:scale-90 disabled:opacity-50 rounded-lg transition"
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
                          className="w-full flex items-center justify-center py-1.5 rounded-xl border-2 border-agro-600 dark:border-agro-500 bg-agro-50/70 dark:bg-agro-600 text-agro-700 dark:text-white hover:bg-agro-600 hover:text-white dark:hover:bg-agro-700 dark:hover:text-white active:scale-95 text-xs font-extrabold tracking-wide transition shadow-2xs disabled:opacity-50 min-h-[34px]"
                        >
                          ADD
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
