import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  Clock,
  TrendingUp,
  Receipt,
  CreditCard,
  AlertCircle,
  Boxes,
  ClipboardList,
  Wallet,
  BadgeIndianRupee,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import api, { getErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDateTime, formatQty } from '../../utils/formatters';
import StatusBadge from '../../components/common/StatusBadge';
import { LoadingSpinner } from '../../components/common/Feedback';

function MetricCard({ title, value, subtitle, icon: Icon, color = 'agro', to = null }) {
  const colors = {
    agro: 'bg-agro-50 text-agro-700',
    sky: 'bg-sky-50 text-sky-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    purple: 'bg-purple-50 text-purple-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  };

  const inner = (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition h-full flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <div className={`p-2.5 rounded-xl ${colors[color] || colors.agro}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {subtitle && <p className="text-xs text-slate-500 mt-2">{subtitle}</p>}
    </div>
  );

  return to ? <Link to={to}>{inner}</Link> : inner;
}

export default function DashboardPage() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/admin/dashboard');
        setData(res.data.data);
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to load dashboard'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [toast]);

  if (loading || !data) return <LoadingSpinner label="Loading business dashboard..." />;

  const { metrics, salesChart, shortagePreview, recentOrders } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Executive Dashboard</h1>
          <p className="text-sm text-slate-500">
            Live operational &amp; accounting overview for Shree Krishna Agro Pvt. Ltd.
          </p>
        </div>
        <Link
          to="/admin/purchase-requirements"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold shadow-sm"
        >
          <ClipboardList className="w-4 h-4" />
          Shortages ({metrics.itemsRequiringPurchase})
        </Link>
      </div>

      {/* 12 Dashboard Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Today's Orders"
          value={metrics.todaysOrders}
          subtitle={`Total active orders: ${metrics.totalOrders}`}
          icon={ShoppingBag}
          color="sky"
          to="/admin/orders"
        />
        <MetricCard
          title="Pending Orders"
          value={metrics.pendingOrders}
          subtitle="Awaiting confirmation or delivery"
          icon={Clock}
          color="amber"
          to="/admin/orders"
        />
        <MetricCard
          title="Total Sales (Delivered)"
          value={formatCurrency(metrics.totalSales)}
          subtitle="Net delivered revenue"
          icon={TrendingUp}
          color="agro"
          to="/admin/reports"
        />
        <MetricCard
          title="Total Purchases"
          value={formatCurrency(metrics.totalPurchases)}
          subtitle="Received supplier stock value"
          icon={Receipt}
          color="purple"
          to="/admin/purchases"
        />
        <MetricCard
          title="Received Payments"
          value={formatCurrency(metrics.totalReceivedPayments)}
          subtitle="Net collections after refunds"
          icon={CreditCard}
          color="emerald"
          to="/admin/payments"
        />
        <MetricCard
          title="Customer Dues"
          value={formatCurrency(metrics.outstandingCustomerDues)}
          subtitle="Outstanding receivables"
          icon={AlertCircle}
          color="red"
          to="/admin/reports"
        />
        <MetricCard
          title="Available Stock"
          value={formatQty(metrics.availableStock)}
          subtitle={`Valuation: ${formatCurrency(metrics.inventoryValuation)}`}
          icon={Boxes}
          color="sky"
          to="/admin/inventory"
        />
        <MetricCard
          title="Items Requiring Purchase"
          value={metrics.itemsRequiringPurchase}
          subtitle="Vegetables in shortage"
          icon={ClipboardList}
          color={metrics.itemsRequiringPurchase > 0 ? 'red' : 'agro'}
          to="/admin/purchase-requirements"
        />
        <MetricCard
          title="Total Expenses"
          value={formatCurrency(metrics.totalExpenses)}
          subtitle="Operational expenses"
          icon={Wallet}
          color="amber"
          to="/admin/expenses"
        />
        <MetricCard
          title="Gross Profit"
          value={formatCurrency(metrics.grossProfit)}
          subtitle="Net Sales - Weighted Avg COGS"
          icon={BadgeIndianRupee}
          color="agro"
          to="/admin/reports"
        />
        <MetricCard
          title="Net Profit"
          value={formatCurrency(metrics.netProfit)}
          subtitle="Gross Profit - Expenses"
          icon={TrendingUp}
          color={metrics.netProfit >= 0 ? 'emerald' : 'red'}
          to="/admin/reports"
        />
        <MetricCard
          title="Total Orders"
          value={metrics.totalOrders}
          subtitle="Non-cancelled orders"
          icon={ShoppingBag}
          color="purple"
          to="/admin/orders"
        />
      </div>

      {/* Chart + Shortages */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-bold text-slate-900 mb-4">Delivered Sales Trend (Last 14 Days)</h2>
          <div className="h-64">
            {salesChart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                No deliveries recorded in the last 14 days yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesChart}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#16a34a"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#salesGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900">Purchase Shortages</h2>
            <Link
              to="/admin/purchase-requirements"
              className="text-xs font-semibold text-agro-700 hover:underline flex items-center gap-1"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {shortagePreview.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-emerald-700 bg-emerald-50 rounded-xl p-4 text-center">
              All confirmed order demand is covered by available stock!
            </div>
          ) : (
            <div className="space-y-2.5 flex-1">
              {shortagePreview.map((item) => (
                <div
                  key={item.vegetable_id}
                  className="p-3 rounded-xl bg-red-50/70 border border-red-100 flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{item.vegetable_name}</div>
                    <div className="text-xs text-slate-500">
                      Req: {formatQty(item.total_confirmed_demand, item.base_unit)} | Avail:{' '}
                      {formatQty(item.available_unallocated_stock, item.base_unit)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-red-700">Shortage</div>
                    <div className="text-sm font-bold text-red-700">
                      {formatQty(item.purchase_shortage, item.base_unit)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Recent Customer Orders</h2>
          <Link to="/admin/orders" className="text-xs font-semibold text-agro-700 hover:underline">
            Manage All Orders →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentOrders.map((ord) => (
                <tr key={ord.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-semibold">
                    <Link to={`/admin/orders/${ord.id}`} className="text-agro-700 hover:underline">
                      {ord.order_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{ord.customer_name}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(ord.created_at)}</td>
                  <td className="px-4 py-3"><StatusBadge status={ord.status} /></td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(ord.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
