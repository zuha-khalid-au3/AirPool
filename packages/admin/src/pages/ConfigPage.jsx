import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import axios from 'axios';

const API_BASE = '/api/v1';

export default function ConfigPage() {
  const [configs, setConfigs] = useState({});
  const [activeTab, setActiveTab] = useState('theme');
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await axios.get(`${API_BASE}/config/app`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConfigs(response.data.data);
    } catch (error) {
      toast.error('Failed to load configurations');
    }
  };

  const handleSave = async (key, category, value) => {
    try {
      const token = localStorage.getItem('admin_token');
      await axios.post(
        `${API_BASE}/admin/config`,
        { key, category, value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Configuration updated! Changes will reflect in the app within 5 minutes.');
      setEditingKey(null);
      fetchConfigs();
    } catch (error) {
      toast.error('Failed to save configuration');
    }
  };

  const tabs = [
    { id: 'theme', label: 'Theme & Colors', icon: '🎨' },
    { id: 'feature_flags', label: 'Feature Flags', icon: '🚩' },
    { id: 'airports', label: 'Airports', icon: '✈️' },
    { id: 'vehicles', label: 'Vehicles', icon: '🚗' },
    { id: 'announcements', label: 'Announcements', icon: '📢' },
    { id: 'general', label: 'General', icon: '⚙️' },
  ];

  const currentConfigs = configs[activeTab] || {};

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">App Configuration</h1>
          <p className="text-slate-500 mt-1">
            Server-Driven UI — Changes here update the mobile app without redeployment
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Config Content */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {Object.keys(currentConfigs).length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400 text-lg">No configurations found for this category</p>
            <p className="text-slate-400 text-sm mt-2">
              Run the seed script to populate default configurations
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {Object.entries(currentConfigs).map(([key, value]) => (
              <div key={key} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-900">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </h3>
                    <p className="text-slate-400 text-xs mt-1 font-mono">{key}</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingKey(key);
                      setEditValue(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
                    }}
                    className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                  >
                    Edit
                  </button>
                </div>

                {editingKey === key ? (
                  <div className="mt-4">
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-3 text-sm font-mono min-h-[100px] focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      rows={typeof value === 'object' ? 8 : 2}
                    />
                    <div className="flex space-x-3 mt-3">
                      <button
                        onClick={() => {
                          let parsedValue;
                          try {
                            parsedValue = JSON.parse(editValue);
                          } catch {
                            parsedValue = editValue;
                          }
                          handleSave(key, activeTab, parsedValue);
                        }}
                        className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={() => setEditingKey(null)}
                        className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 bg-slate-50 rounded-lg p-3">
                    <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono">
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
