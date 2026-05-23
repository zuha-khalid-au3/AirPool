import React, { useEffect, useState } from 'react';
import api from '../api';

export default function PoolsPage() {
  const [pools, setPools] = useState([]);
  const [filter, setFilter] = useState('active');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPools = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/admin/pools', {
          params: filter === 'all' ? {} : { status: filter },
        });
        setPools(response.data.data.pools);
      } catch (error) {
        setPools([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPools();
  }, [filter]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Ride Pools</h1>
      <p className="text-slate-500 mb-8">Monitor and manage active and completed ride pools</p>

      <div className="flex items-center space-x-3 mb-6">
        {['active', 'open', 'full', 'in_progress', 'completed', 'cancelled', 'all'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
              filter === status
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Flight</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Route</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Creator</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Members</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                  Loading pools…
                </td>
              </tr>
            ) : pools.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                  No pools found for this filter.
                </td>
              </tr>
            ) : (
              pools.map((pool) => (
                <tr key={pool._id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{pool.flightNumber}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {pool.arrivalAirport?.code} → {pool.destination?.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {pool.creator?.name || 'Unknown'}
                    {pool.creator?.isGuest && (
                      <span className="ml-2 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                        Guest
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {pool.members?.filter((m) => m.status === 'active').length || 0} / {pool.maxMembers}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                      pool.status === 'open' ? 'bg-green-100 text-green-700' :
                      pool.status === 'full' ? 'bg-blue-100 text-blue-700' :
                      pool.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                      pool.status === 'completed' ? 'bg-purple-100 text-purple-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {pool.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(pool.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
