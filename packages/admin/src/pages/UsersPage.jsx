import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">User Management</h1>
      <p className="text-slate-500 mb-8">View, verify, and manage all registered users</p>

      {/* Filters */}
      <div className="flex items-center space-x-4 mb-6">
        <input
          type="text"
          placeholder="Search by name, phone, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-4 py-2 text-sm"
        >
          <option value="all">All Users</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
          <option value="banned">Banned</option>
          <option value="pending_kyc">Pending KYC</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">User</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Phone</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">KYC Status</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Trust Score</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                  No users found. Users will appear here once they register.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user._id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{user.name}</div>
                    <div className="text-slate-400 text-xs">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{user.phone}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.kycStatus === 'approved' ? 'bg-green-100 text-green-700' :
                      user.kycStatus === 'submitted' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {user.kycStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{user.trustScore}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.isBanned ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {user.isBanned ? 'Banned' : 'Active'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button className="text-primary-600 hover:text-primary-800 text-sm font-medium">
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Info */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
        <p className="text-blue-700 text-sm">
          💡 For full CRUD operations with advanced filtering, use the <strong>AdminJS panel</strong> at{' '}
          <code className="bg-blue-100 px-1 rounded">/admin</code> on the backend server.
        </p>
      </div>
    </div>
  );
}
