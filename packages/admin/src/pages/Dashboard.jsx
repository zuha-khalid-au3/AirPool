import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activePools: 0,
    completedRides: 0,
    pendingKYC: 0,
  });

  useEffect(() => {
    // In production, fetch from API
    setStats({
      totalUsers: 0,
      activePools: 0,
      completedRides: 0,
      pendingKYC: 0,
    });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-8">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Users" value={stats.totalUsers} icon="👥" color="blue" />
        <StatCard title="Active Pools" value={stats.activePools} icon="🚗" color="green" />
        <StatCard title="Completed Rides" value={stats.completedRides} icon="✅" color="purple" />
        <StatCard title="Pending KYC" value={stats.pendingKYC} icon="⏳" color="orange" />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 mb-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickAction label="Manage Users" href="/users" icon="👥" />
          <QuickAction label="View Pools" href="/pools" icon="🚗" />
          <QuickAction label="App Config" href="/config" icon="⚙️" />
          <QuickAction label="Fraud Alerts" href="/fraud" icon="🛡️" />
        </div>
      </div>

      {/* Info */}
      <div className="bg-primary-50 rounded-xl p-6 border border-primary-200">
        <h3 className="text-primary-800 font-semibold mb-2">Admin Panel Features</h3>
        <ul className="text-primary-700 text-sm space-y-2">
          <li>• <strong>Users</strong>: View, ban/unban users, approve KYC documents</li>
          <li>• <strong>Ride Pools</strong>: Monitor active pools, resolve disputes</li>
          <li>• <strong>App Config</strong>: Change colors, airports, vehicles, feature flags (Server-Driven UI)</li>
          <li>• <strong>Fraud Alerts</strong>: Review suspicious activities, take action</li>
          <li>• <strong>AdminJS</strong>: Full CRUD available at <code>/admin</code> route on the backend</li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <span className={`text-2xl p-2 rounded-lg ${colorMap[color]}`}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-slate-500 text-sm mt-1">{title}</p>
    </div>
  );
}

function QuickAction({ label, href, icon }) {
  return (
    <a
      href={href}
      className="flex flex-col items-center p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
    >
      <span className="text-2xl mb-2">{icon}</span>
      <span className="text-sm text-slate-700 font-medium">{label}</span>
    </a>
  );
}
