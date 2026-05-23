import React from 'react';

export default function PoolsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Ride Pools</h1>
      <p className="text-slate-500 mb-8">Monitor and manage active and completed ride pools</p>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
        <span className="text-5xl mb-4 block">🚗</span>
        <h3 className="text-lg font-semibold text-slate-700">Pool Management</h3>
        <p className="text-slate-400 mt-2 max-w-md mx-auto">
          Active pools will appear here. You can view details, cancel pools, resolve disputes,
          and monitor real-time ride status.
        </p>
        <div className="mt-6">
          <a
            href="/admin"
            className="inline-block bg-primary-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            Open AdminJS Panel for Full CRUD
          </a>
        </div>
      </div>
    </div>
  );
}
