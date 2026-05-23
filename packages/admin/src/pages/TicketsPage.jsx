import React from 'react';

export default function TicketsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Flight Tickets</h1>
      <p className="text-slate-500 mb-8">Review uploaded tickets and OCR results</p>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
        <span className="text-5xl mb-4 block">🎫</span>
        <h3 className="text-lg font-semibold text-slate-700">Ticket Management</h3>
        <p className="text-slate-400 mt-2 max-w-md mx-auto">
          Uploaded flight tickets will appear here. You can verify OCR results,
          approve/reject tickets, and link them to user profiles.
        </p>
      </div>
    </div>
  );
}
