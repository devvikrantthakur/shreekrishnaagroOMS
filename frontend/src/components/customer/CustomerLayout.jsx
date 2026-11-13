import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Sprout,
  ShoppingCart,
  Package,
  CreditCard,
  User,
  LogOut,
  LogIn,
  ShieldCheck,
  ArrowRight,
  Store,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { formatCurrency } from '../../utils/formatters';
import ThemeToggle from '../common/ThemeToggle';

export default function CustomerLayout() {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinkClass = (path) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition ${
      location.pathname === path
        ? 'bg-agro-50 dark:bg-agro-600 text-agro-700 dark:text-white font-semibold shadow-xs'
        : 'text-slate-600 dark:text-slate-300 hover:text-agro-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
    }`;

  const mobileTabClass = (path) => {
    const active =
      path === '/'
        ? location.pathname === '/' || location.pathname.startsWith('/vegetables')
        : location.pathname.startsWith(path);
    return `relative flex-1 flex flex-col items-center justify-center py-1.5 text-[11px] font-semibold transition ${
      active
        ? 'text-agro-700 dark:text-white'
        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
    }`;
  };

  const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN');

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8f5] dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-clip transition-colors duration-200">
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          <Link to="/" className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-agro-600 to-emerald-700 flex items-center justify-center text-white shadow-sm shrink-0">
              <Sprout className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-slate-900 dark:text-white tracking-tight text-sm sm:text-lg block leading-tight truncate">
                Shree Krishna Agro
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-agro-600 dark:text-agro-400 block truncate">
                Farm-Fresh Daily Supply
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link to="/" className={navLinkClass('/')}>
              Shop Fresh
            </Link>
            {user && (
              <>
                <Link to="/orders" className={navLinkClass('/orders')}>
                  <Package className="w-4 h-4" /> My Orders
                </Link>
                <Link to="/payments" className={navLinkClass('/payments')}>
                  <CreditCard className="w-4 h-4" /> Payments
                </Link>
                <Link to="/profile" className={navLinkClass('/profile')}>
                  <User className="w-4 h-4" /> Profile
                </Link>
              </>
            )}
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 ml-2"
              >
                <ShieldCheck className="w-4 h-4" /> Admin Panel
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Dark Mode Toggle */}
            <ThemeToggle />

            {isAdmin && (
              <Link
                to="/admin"
                className="md:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Admin
              </Link>
            )}

            <Link
              to="/checkout"
              className="hidden md:flex relative items-center gap-2 px-3.5 py-2 rounded-xl bg-agro-600 hover:bg-agro-700 text-white text-sm font-semibold shadow-sm transition"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Cart</span>
              {cart.itemCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-white text-agro-700 rounded-full font-bold">
                  {cart.itemCount}
                </span>
              )}
            </Link>

            {user ? (
              <>
                <Link
                  to="/profile"
                  title={user.full_name}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold transition max-w-[125px] sm:max-w-[200px]"
                >
                  <span className="w-6 h-6 rounded-full bg-agro-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {(user.full_name || 'U').charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate">{user.full_name}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  title="Logout"
                  aria-label="Logout"
                  className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden md:inline">Logout</span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border border-agro-600 text-agro-700 dark:text-agro-400 hover:bg-agro-50 dark:hover:bg-agro-950 text-xs sm:text-sm font-semibold"
              >
                <LogIn className="w-4 h-4" /> Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-36 md:pb-24 min-w-0">
        <Outlet />
      </main>

      {/* Sticky Cart Summary Bar */}
      {cart.itemCount > 0 && location.pathname !== '/checkout' && (
        <div className="fixed bottom-[4.25rem] md:bottom-5 left-0 right-0 z-30 px-3 sm:px-4 pointer-events-none">
          <div className="max-w-lg mx-auto pointer-events-auto">
            <Link
              to="/checkout"
              className="flex items-center justify-between bg-agro-700 hover:bg-agro-800 text-white px-4 py-3 rounded-2xl shadow-xl border border-agro-500/30 transition active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-white/15 rounded-xl shrink-0">
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] text-agro-100 font-medium">
                    {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'} added
                  </div>
                  <div className="text-sm sm:text-base font-bold leading-tight">
                    {formatCurrency(cart.subtotal)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs sm:text-sm font-bold bg-white/15 px-3 py-1.5 rounded-xl shrink-0">
                View Cart <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-1 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center h-14">
          <Link to="/" className={mobileTabClass('/')}>
            <Store className="w-5 h-5 mb-0.5" />
            <span>Shop</span>
          </Link>
          <Link to={user ? '/orders' : '/login'} className={mobileTabClass('/orders')}>
            <Package className="w-5 h-5 mb-0.5" />
            <span>Orders</span>
          </Link>
          <Link to="/checkout" className={mobileTabClass('/checkout')}>
            <div className="relative">
              <ShoppingCart className="w-5 h-5 mb-0.5" />
              {cart.itemCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-agro-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {cart.itemCount}
                </span>
              )}
            </div>
            <span>Cart</span>
          </Link>
          <Link to={user ? '/payments' : '/login'} className={mobileTabClass('/payments')}>
            <CreditCard className="w-5 h-5 mb-0.5" />
            <span>Payments</span>
          </Link>
          <Link to={user ? '/profile' : '/login'} className={mobileTabClass('/profile')}>
            <User className="w-5 h-5 mb-0.5" />
            <span>{user ? 'Account' : 'Login'}</span>
          </Link>
        </div>
      </nav>

      <footer className="hidden md:block bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div>
            © {new Date().getFullYear()} <strong className="text-slate-700 dark:text-slate-200">SHREE KRISHNA AGRO PVT. LTD.</strong> All rights reserved.
          </div>
          <div>Direct Farm-to-Kitchen Fresh Produce Supply &amp; Order Management</div>
        </div>
      </footer>
    </div>
  );
}
