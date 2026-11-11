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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { formatCurrency } from '../../utils/formatters';

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
        ? 'bg-agro-50 text-agro-700'
        : 'text-slate-600 hover:text-agro-700 hover:bg-slate-50'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-agro-600 to-agro-700 flex items-center justify-center text-white shadow-sm">
              <Sprout className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg block leading-tight">
                Shree Krishna Agro
              </span>
              <span className="text-[11px] font-medium text-agro-600 block">
                Farm Fresh Vegetables
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
            {user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 ml-2"
              >
                <ShieldCheck className="w-4 h-4" /> Admin Panel
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/checkout"
              className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl bg-agro-600 hover:bg-agro-700 text-white text-sm font-semibold shadow-sm transition"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">Cart</span>
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
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-800 text-sm font-semibold transition max-w-[160px] sm:max-w-[220px]"
                >
                  <span className="w-6 h-6 rounded-full bg-agro-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {(user.full_name || 'U').charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate">{user.full_name}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  title="Logout"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden md:inline">Logout</span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-agro-600 text-agro-700 hover:bg-agro-50 text-sm font-semibold"
              >
                <LogIn className="w-4 h-4" /> Login
              </Link>
            )}
          </div>
        </div>

        {/* Mobile quick nav */}
        {user && (
          <div className="md:hidden border-t border-slate-100 px-4 py-2 flex items-center gap-2 overflow-x-auto bg-white">
            <Link to="/" className={navLinkClass('/')}>Shop</Link>
            <Link to="/orders" className={navLinkClass('/orders')}>Orders</Link>
            <Link to="/payments" className={navLinkClass('/payments')}>Payments</Link>
            <Link to="/profile" className={navLinkClass('/profile')}>Profile</Link>
            {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
              <Link to="/admin" className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-white shrink-0">
                Admin
              </Link>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 pb-24">
        <Outlet />
      </main>

      {/* Sticky Cart Summary Bar */}
      {cart.itemCount > 0 && location.pathname !== '/checkout' && (
        <div className="fixed bottom-4 left-0 right-0 z-40 px-4 pointer-events-none">
          <div className="max-w-xl mx-auto pointer-events-auto">
            <Link
              to="/checkout"
              className="flex items-center justify-between bg-agro-700 hover:bg-agro-800 text-white px-5 py-3.5 rounded-2xl shadow-xl transition"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/15 rounded-xl">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-agro-100 font-medium">
                    {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'} in cart
                  </div>
                  <div className="text-base font-bold">{formatCurrency(cart.subtotal)}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                Proceed to Checkout <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          </div>
        </div>
      )}

      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} <strong className="text-slate-700">SHREE KRISHNA AGRO PVT. LTD.</strong> All rights reserved.
          </div>
          <div>Direct Farm-to-Kitchen Fresh Produce Supply &amp; Order Management</div>
        </div>
      </footer>
    </div>
  );
}
