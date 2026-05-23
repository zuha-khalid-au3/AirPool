import React from 'react';

export default function FraudPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Fraud & Safety Alerts</h1>
      <p className="text-slate-500 mb-8">Monitor suspicious activities and take action</p>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
        <span className="text-5xl mb-4 block">🛡️</span>
        <h3 className="text-lg font-semibold text-slate-700">Fraud Detection</h3>
        <p className="text-slate-400 mt-2 max-w-md mx-auto">
          Suspicious activities will be flagged here automatically. Review alerts for
          fake tickets, unusual behavior patterns, and user reports.
        </p>
      </div>
    </div>
  );
}
