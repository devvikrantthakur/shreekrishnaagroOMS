import React from 'react';

const STYLE_MAP = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-400 dark:border dark:border-emerald-800/60',
  INACTIVE: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:border dark:border-slate-700',
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 dark:border dark:border-amber-800/60',
  CONFIRMED: 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 dark:border dark:border-sky-800/60',
  PROCESSING: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border dark:border-indigo-800/60',
  PARTIALLY_DELIVERED: 'bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 dark:border dark:border-orange-800/60',
  DELIVERED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-400 dark:border dark:border-emerald-800/60',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 dark:border dark:border-red-800/60',
  ORDERED: 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 dark:border dark:border-sky-800/60',
  DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:border dark:border-slate-700',
  PARTIALLY_RECEIVED: 'bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 dark:border dark:border-orange-800/60',
  RECEIVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-400 dark:border dark:border-emerald-800/60',
  SUCCESS: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-400 dark:border dark:border-emerald-800/60',
  PAID: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-400 dark:border dark:border-emerald-800/60',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 dark:border dark:border-amber-800/60',
  UNPAID: 'bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 dark:border dark:border-red-800/60',
  REVERSED: 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 dark:border dark:border-rose-800/60',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 dark:border dark:border-red-800/60',
  ISSUED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-400 dark:border dark:border-emerald-800/60',
  CREDIT_NOTE: 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 dark:border dark:border-purple-800/60',
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-400 dark:border dark:border-emerald-800/60',
  PARTIAL: 'bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 dark:border dark:border-orange-800/60',
  ALLOCATED: 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 dark:border dark:border-sky-800/60',
  FULFILLED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-400 dark:border dark:border-emerald-800/60',
  RELEASED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:border dark:border-slate-700',
  SUPER_ADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 dark:border dark:border-purple-800/60',
  ADMIN: 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 dark:border dark:border-sky-800/60',
  CUSTOMER: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-400 dark:border dark:border-emerald-800/60',
};

export default function StatusBadge({ status }) {
  const key = String(status || '').toUpperCase();
  const cls = STYLE_MAP[key] || 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {key.replace(/_/g, ' ')}
    </span>
  );
}
