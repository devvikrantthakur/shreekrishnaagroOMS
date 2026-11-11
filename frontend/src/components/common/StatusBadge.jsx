import React from 'react';

const STYLE_MAP = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  INACTIVE: 'bg-slate-100 text-slate-600',
  PENDING: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-sky-100 text-sky-800',
  PROCESSING: 'bg-indigo-100 text-indigo-800',
  PARTIALLY_DELIVERED: 'bg-orange-100 text-orange-800',
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-700',
  ORDERED: 'bg-sky-100 text-sky-800',
  DRAFT: 'bg-slate-100 text-slate-700',
  PARTIALLY_RECEIVED: 'bg-orange-100 text-orange-800',
  RECEIVED: 'bg-emerald-100 text-emerald-800',
  SUCCESS: 'bg-emerald-100 text-emerald-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-800',
  UNPAID: 'bg-red-100 text-red-700',
  REVERSED: 'bg-rose-100 text-rose-700',
  FAILED: 'bg-red-100 text-red-700',
  ISSUED: 'bg-emerald-100 text-emerald-800',
  CREDIT_NOTE: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  PARTIAL: 'bg-orange-100 text-orange-800',
  ALLOCATED: 'bg-sky-100 text-sky-800',
  FULFILLED: 'bg-emerald-100 text-emerald-800',
  RELEASED: 'bg-slate-100 text-slate-600',
  SUPER_ADMIN: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-sky-100 text-sky-800',
  CUSTOMER: 'bg-emerald-100 text-emerald-800',
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
