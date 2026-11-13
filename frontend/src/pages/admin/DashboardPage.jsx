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
  LineChart,
  Line,
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
    agro: 'bg-agro-50 text-agro-700 dark:bg-agro-950/60 dark:text-agro-400',
    sky: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400',
    red: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400',
    purple: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400',
  };

  const inner = (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 shadow-sm hover:shadow-md transition h-full flex flex-col justify-between min-w-0">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">
            {title}
          </p>
          <p className="text-base sm:text-xl font-bold text-slate-900 dark:text-white mt-1 truncate">{value}</p>
        </div>
        <div className={`p-2 sm:p-2.5 rounded-xl shrink-0 ${colors[color] || colors.agro}`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
      {subtitle && <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">{subtitle}</p>}
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
    <div className="space-y-5 sm:space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Executive Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Live operational &amp; accounting overview for Shree Krishna Agro Pvt. Ltd.
          </p>
        </div>
        <Link
          to="/admin/purchase-requirements"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold shadow-sm w-full sm:w-auto shrink-0"
        >
          <ClipboardList className="w-4 h-4" />
          Shortages ({metrics.itemsRequiringPurchase})
        </Link>
      </div>

      {/* 12 Dashboard Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm overflow-hidden min-w-0 transition-colors">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4 text-sm sm:text-base">
            Delivered Sales Trend (Last 14 Days)
          </h2>
          <div className="h-56 sm:h-64 min-w-0">
            {salesChart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
                No deliveries recorded in the last 14 days yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesChart} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.25} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    stroke="#94a3b8"
                    strokeOpacity={0.4}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    stroke="#94a3b8"
                    strokeOpacity={0.4}
                  />
                  <Tooltip
                    formatter={(v) => [formatCurrency(v), 'Delivered Sales']}
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                    labelStyle={{ color: '#cbd5e1', fontWeight: 600 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    name="Delivered Sales"
                    stroke="#16a34a"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#16a34a', strokeWidth: 2, stroke: '#ffffff' }}
                    activeDot={{ r: 6, fill: '#15803d', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col transition-colors">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900 dark:text-white">Purchase Shortages</h2>
            <Link
              to="/admin/purchase-requirements"
              className="text-xs font-semibold text-agro-700 dark:text-agro-400 hover:underline flex items-center gap-1"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {shortagePreview.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-emerald-700 dark:text-white bg-emerald-50 dark:bg-slate-800/80 border border-emerald-200 dark:border-slate-700 rounded-xl p-4 text-center">
              All confirmed order demand is covered by available stock!
            </div>
          ) : (
            <div className="space-y-2.5 flex-1">
              {shortagePreview.map((item) => (
                <div
                  key={item.vegetable_id}
                  className="p-3 rounded-xl bg-red-50/70 dark:bg-red-950/40 border border-red-100 dark:border-red-900/60 flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white text-sm">{item.vegetable_name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Req: {formatQty(item.total_confirmed_demand, item.base_unit)} | Avail:{' '}
                      {formatQty(item.available_unallocated_stock, item.base_unit)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-red-700 dark:text-red-400">Shortage</div>
                    <div className="text-sm font-bold text-red-700 dark:text-red-400">
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-colors">
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <h2 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Recent Customer Orders</h2>
          <Link to="/admin/orders" className="text-xs font-semibold text-agro-700 dark:text-agro-400 hover:underline shrink-0">
            Manage All →
          </Link>
        </div>

        {/* Mobile Cards */}
        <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {recentOrders.map((ord) => (
            <Link
              key={ord.id}
              to={`/admin/orders/${ord.id}`}
              className="block p-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/70 transition"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm text-agro-700 dark:text-agro-400 truncate">{ord.order_number}</span>
                <StatusBadge status={ord.status} />
              </div>
              <div className="flex items-center justify-between gap-2 mt-1.5 text-xs text-slate-600 dark:text-slate-400">
                <span className="truncate font-medium text-slate-800 dark:text-slate-200">{ord.customer_name}</span>
                <span className="font-bold text-slate-900 dark:text-white shrink-0">{formatCurrency(ord.total_amount)}</span>
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{formatDateTime(ord.created_at)}</div>
            </Link>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentOrders.map((ord) => (
                <tr key={ord.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/60">
                  <td className="px-4 py-3 font-semibold">
                    <Link to={`/admin/orders/${ord.id}`} className="text-agro-700 dark:text-agro-400 hover:underline">
                      {ord.order_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-800 dark:text-slate-200">{ord.customer_name}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDateTime(ord.created_at)}</td>
                  <td className="px-4 py-3"><StatusBadge status={ord.status} /></td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">{formatCurrency(ord.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
