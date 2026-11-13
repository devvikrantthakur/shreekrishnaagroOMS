import React, { useState, useEffect, useCallback } from 'react';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import api, { downloadFileWithAuth, getErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDate, formatQty } from '../../utils/formatters';
import { LoadingSpinner } from '../../components/common/Feedback';

const TABS = [
  { id: 'pnl', label: 'Profit & Loss Statement' },
  { id: 'sales', label: 'Sales Report' },
  { id: 'purchases', label: 'Purchase Report' },
  { id: 'vegetable-sales', label: 'Vegetable-wise Sales' },
  { id: 'vegetable-purchases', label: 'Vegetable-wise Purchases' },
  { id: 'customer-sales', label: 'Customer-wise Sales' },
  { id: 'customer-dues', label: 'Customer Dues' },
  { id: 'supplier-payables', label: 'Supplier Payables' },
  { id: 'payment-collections', label: 'Payment Collections' },
  { id: 'expenses', label: 'Expense Report' },
  { id: 'inventory-valuation', label: 'Inventory Valuation' },
];

const EXPORTABLE = new Set([
  'pnl',
  'sales',
  'purchases',
  'vegetable-sales',
  'customer-dues',
  'supplier-payables',
  'expenses',
  'inventory-valuation',
]);

export default function ReportsPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('pnl');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [granularity, setGranularity] = useState('daily');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/reports/${activeTab}`, {
        params: {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          granularity: activeTab === 'sales' ? granularity : undefined,
        },
      });
      setData(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [activeTab, startDate, endDate, granularity, toast]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleExport = async (format) => {
    try {
      const qs = new URLSearchParams({
        type: activeTab,
        format,
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        ...(activeTab === 'sales' ? { granularity } : {}),
      }).toString();
      await downloadFileWithAuth(`/admin/reports/export?${qs}`, `${activeTab}-report.${format}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Export failed'));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Accounting & Business Reports</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Vyapar-style financial reporting: Delivered Revenue, Weighted-Average COGS, Gross & Net Profit
          </p>
        </div>

        {EXPORTABLE.has(activeTab) && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Export CSV
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-agro-600 dark:hover:bg-agro-700 text-white text-xs font-semibold transition"
            >
              <FileDown className="w-4 h-4" /> Export PDF
            </button>
          </div>
        )}
      </div>

      {/* Report Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === t.id
                ? 'bg-agro-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Date Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
          />
        </div>
        {activeTab === 'sales' && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Period</label>
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        )}
        <button
          onClick={() => {
            setStartDate('');
            setEndDate('');
          }}
          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
        >
          Clear Dates
        </button>
      </div>

      {loading || !data ? (
        <LoadingSpinner label="Generating report..." />
      ) : activeTab === 'pnl' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 text-sm">
            <h2 className="text-lg font-bold text-slate-900 border-b pb-2">
              Profit & Loss Statement
            </h2>
            <div className="flex justify-between">
              <span className="text-slate-600">Gross Delivered Sales</span>
              <span className="font-medium">{formatCurrency(data.grossDeliveredSales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Less: Proportional Order Discounts</span>
              <span className="text-red-600">- {formatCurrency(data.discounts)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 border-t pt-2">
              <span>Net Sales Revenue (Delivered)</span>
              <span>{formatCurrency(data.netSales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Less: Cost of Goods Sold (Weighted Avg Cost)</span>
              <span className="text-red-600">- {formatCurrency(data.costOfGoodsSold)}</span>
            </div>
            <div className="flex justify-between font-bold text-agro-700 text-base border-t pt-2">
              <span>Gross Profit</span>
              <span>{formatCurrency(data.grossProfit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Less: Business Expenses</span>
              <span className="text-red-600">- {formatCurrency(data.totalExpenses)}</span>
            </div>
            <div
              className={`flex justify-between font-bold text-lg border-t-2 pt-3 ${
                data.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              <span>Net Profit</span>
              <span>{formatCurrency(data.netProfit)}</span>
            </div>
            <div className="text-xs text-slate-400 pt-2">
              Note: Unsold inventory is excluded from COGS. Refunds issued in period:{' '}
              {formatCurrency(data.refundsIssued)}.
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 border-b pb-2 mb-3">
              Expense Breakdown by Category
            </h2>
            {data.expenseBreakdown?.length === 0 ? (
              <p className="text-sm text-slate-500">No expenses in selected period.</p>
            ) : (
              <div className="space-y-2.5 text-sm">
                {data.expenseBreakdown.map((eb) => (
                  <div key={eb.category} className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-700">{eb.category}</span>
                    <span className="font-semibold">{formatCurrency(eb.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'sales' ? (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="net_sales" name="Net Sales" fill="#16a34a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ReportTable
            columns={[
              { key: 'period', label: 'Period' },
              { key: 'orders_count', label: 'Orders', align: 'right' },
              { key: 'deliveries_count', label: 'Deliveries', align: 'right' },
              { key: 'gross_sales', label: 'Gross Sales', align: 'right', money: true },
              { key: 'discounts', label: 'Discounts', align: 'right', money: true },
              { key: 'net_sales', label: 'Net Sales', align: 'right', money: true },
            ]}
            rows={data}
          />
        </div>
      ) : activeTab === 'purchases' ? (
        <ReportTable
          columns={[
            { key: 'purchase_number', label: 'PO #' },
            { key: 'supplier_name', label: 'Supplier' },
            { key: 'purchase_date', label: 'Date', date: true },
            { key: 'status', label: 'Status' },
            { key: 'ordered_amount', label: 'Ordered', align: 'right', money: true },
            { key: 'received_amount', label: 'Received', align: 'right', money: true },
          ]}
          rows={data}
        />
      ) : activeTab === 'vegetable-sales' ? (
        <ReportTable
          columns={[
            { key: 'vegetable_name', label: 'Vegetable' },
            { key: 'base_unit', label: 'Unit' },
            { key: 'delivered_qty', label: 'Delivered Qty', align: 'right' },
            { key: 'sales_amount', label: 'Sales', align: 'right', money: true },
            { key: 'cogs', label: 'COGS', align: 'right', money: true },
            { key: 'gross_profit', label: 'Gross Profit', align: 'right', money: true },
          ]}
          rows={data}
        />
      ) : activeTab === 'vegetable-purchases' ? (
        <ReportTable
          columns={[
            { key: 'vegetable_name', label: 'Vegetable' },
            { key: 'base_unit', label: 'Unit' },
            { key: 'ordered_qty', label: 'Ordered Qty', align: 'right' },
            { key: 'received_qty', label: 'Received Qty', align: 'right' },
            { key: 'avg_unit_cost', label: 'Avg Cost', align: 'right', money: true },
            { key: 'received_cost', label: 'Total Cost', align: 'right', money: true },
          ]}
          rows={data}
        />
      ) : activeTab === 'customer-sales' ? (
        <ReportTable
          columns={[
            { key: 'customer_name', label: 'Customer' },
            { key: 'mobile', label: 'Mobile' },
            { key: 'total_orders', label: 'Orders', align: 'right' },
            { key: 'total_ordered_value', label: 'Total Sales Value', align: 'right', money: true },
          ]}
          rows={data}
        />
      ) : activeTab === 'customer-dues' ? (
        <ReportTable
          columns={[
            { key: 'customer_name', label: 'Customer' },
            { key: 'mobile', label: 'Mobile' },
            { key: 'active_orders', label: 'Orders', align: 'right' },
            { key: 'total_order_amount', label: 'Order Total', align: 'right', money: true },
            { key: 'net_paid', label: 'Paid', align: 'right', money: true },
            { key: 'outstanding_due', label: 'Balance Due', align: 'right', money: true },
          ]}
          rows={data}
        />
      ) : activeTab === 'supplier-payables' ? (
        <ReportTable
          columns={[
            { key: 'supplier_name', label: 'Supplier' },
            { key: 'mobile', label: 'Mobile' },
            { key: 'opening_balance', label: 'Opening', align: 'right', money: true },
            { key: 'total_received_purchases', label: 'Purchased', align: 'right', money: true },
            { key: 'total_paid', label: 'Paid', align: 'right', money: true },
            { key: 'outstanding_payable', label: 'Payable', align: 'right', money: true },
          ]}
          rows={data}
        />
      ) : activeTab === 'payment-collections' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(data.byMethod || []).map((m) => (
              <div key={m.payment_method} className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-semibold text-slate-500">{m.payment_method}</div>
                <div className="text-xl font-bold mt-1">{formatCurrency(m.total_amount)}</div>
                <div className="text-xs text-slate-400">{m.tx_count} transactions</div>
              </div>
            ))}
          </div>
          <ReportTable
            columns={[
              { key: 'payment_number', label: 'Payment #' },
              { key: 'order_number', label: 'Order #' },
              { key: 'customer_name', label: 'Customer' },
              { key: 'payment_method', label: 'Method' },
              { key: 'payment_date', label: 'Date', date: true },
              { key: 'amount', label: 'Amount', align: 'right', money: true },
            ]}
            rows={data.transactions || []}
          />
        </div>
      ) : activeTab === 'expenses' ? (
        <ReportTable
          columns={[
            { key: 'expense_date', label: 'Date', date: true },
            { key: 'title', label: 'Title' },
            { key: 'category', label: 'Category' },
            { key: 'payment_method', label: 'Method' },
            { key: 'amount', label: 'Amount', align: 'right', money: true },
          ]}
          rows={data.items || []}
        />
      ) : (
        <ReportTable
          columns={[
            { key: 'name', label: 'Vegetable' },
            { key: 'base_unit', label: 'Unit' },
            { key: 'current_stock', label: 'Current Stock', align: 'right' },
            { key: 'reserved_stock', label: 'Reserved', align: 'right' },
            { key: 'available_stock', label: 'Available', align: 'right' },
            { key: 'weighted_avg_cost', label: 'Avg Cost', align: 'right', money: true },
            { key: 'inventory_value', label: 'Valuation', align: 'right', money: true },
          ]}
          rows={data}
        />
      )}
    </div>
  );
}

function ReportTable({ columns, rows }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-3 ${c.align === 'right' ? 'text-right' : ''}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">
                  No records for selected criteria.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/60">
                  {columns.map((c) => {
                    let val = r[c.key];
                    if (c.money) val = formatCurrency(val);
                    else if (c.date) val = formatDate(val);
                    else if (typeof val === 'number' && !Number.isInteger(val)) val = formatQty(val);
                    return (
                      <td
                        key={c.key}
                        className={`px-4 py-3 ${c.align === 'right' ? 'text-right font-medium' : ''}`}
                      >
                        {val ?? '-'}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
