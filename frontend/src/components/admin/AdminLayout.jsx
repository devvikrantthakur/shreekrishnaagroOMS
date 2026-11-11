import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  ShoppingBag,
  Truck,
  Carrot,
  Tags,
  Boxes,
  Factory,
  Receipt,
  CreditCard,
  FileText,
  Wallet,
  Users,
  BarChart3,
  History,
  LogOut,
  Menu,
  X,
  Sprout,
  Store,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, exact: true },
  { label: 'Purchase Requirements', to: '/admin/purchase-requirements', icon: ClipboardList, highlight: true },
  { label: 'Orders', to: '/admin/orders', icon: ShoppingBag },
  { label: 'Deliveries', to: '/admin/deliveries', icon: Truck },
  { label: 'Vegetables', to: '/admin/vegetables', icon: Carrot },
  { label: 'Categories', to: '/admin/categories', icon: Tags },
  { label: 'Inventory & Ledger', to: '/admin/inventory', icon: Boxes },
  { label: 'Suppliers', to: '/admin/suppliers', icon: Factory },
  { label: 'Purchases', to: '/admin/purchases', icon: Receipt },
  { label: 'Payments', to: '/admin/payments', icon: CreditCard },
  { label: 'Invoices', to: '/admin/invoices', icon: FileText },
  { label: 'Expenses', to: '/admin/expenses', icon: Wallet },
  { label: 'Users & Customers', to: '/admin/users', icon: Users },
  { label: 'Reports & P&L', to: '/admin/reports', icon: BarChart3 },
  { label: 'Audit Logs', to: '/admin/audit-logs', icon: History },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.to;
    return location.pathname.startsWith(item.to);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 overflow-hidden">
      <div className="h-16 px-5 shrink-0 flex items-center justify-between border-b border-slate-800 bg-slate-900">
        <Link to="/admin" className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-agro-600 flex items-center justify-center text-white shrink-0">
            <Sprout className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white leading-tight truncate">Shree Krishna Agro</div>
            <div className="text-[11px] text-agro-400 font-medium truncate">OMS Admin Console</div>
          </div>
        </Link>
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                active
                  ? 'bg-agro-600 text-white shadow-sm'
                  : item.highlight
                  ? 'text-amber-300 hover:bg-slate-800'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 shrink-0 border-t border-slate-800 bg-slate-900 space-y-2">
        <Link
          to="/"
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          <Store className="w-4 h-4 text-agro-400 shrink-0" /> View Customer Storefront
        </Link>
        <div className="px-3 py-2 rounded-xl bg-slate-800/70">
          <div className="text-xs font-semibold text-white truncate">{user?.full_name}</div>
          <div className="text-[11px] text-agro-400">{user?.role}</div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-red-600/20 text-red-300 hover:bg-red-600 hover:text-white text-xs font-semibold transition"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-100 overflow-x-clip">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen z-40 bg-slate-900 border-r border-slate-800">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-72 max-w-[85vw] shrink-0 h-full bg-slate-900 shadow-2xl relative z-10">
            {sidebarContent}
          </div>
          <div className="flex-1 bg-slate-950/60 backdrop-blur-[1px]" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative z-0">
        <header className="h-14 sm:h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between gap-2 sticky top-0 z-30">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 shrink-0"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm sm:text-base font-semibold text-slate-800 truncate">
              <span className="sm:hidden">Shree Krishna Agro OMS</span>
              <span className="hidden sm:inline">
                SHREE KRISHNA AGRO PVT. LTD. — Order Management System
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 max-w-[140px] sm:max-w-[240px] shrink-0">
            <span className="w-6 h-6 rounded-full bg-agro-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              {(user?.full_name || 'A').charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 truncate">{user?.full_name}</div>
              <div className="text-[10px] font-medium text-agro-700 leading-none hidden sm:block">
                {user?.role}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0 p-3 sm:p-6 max-w-[1400px] w-full mx-auto overflow-x-clip">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
