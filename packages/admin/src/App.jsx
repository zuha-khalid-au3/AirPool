import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import UsersPage from './pages/UsersPage';
import PoolsPage from './pages/PoolsPage';
import ConfigPage from './pages/ConfigPage';
import TicketsPage from './pages/TicketsPage';
import FraudPage from './pages/FraudPage';
import LoginPage from './pages/LoginPage';

function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(
    () => !!localStorage.getItem('admin_token')
  );

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage onLogin={() => setIsAuthenticated(true)} />
        <Toaster position="top-right" />
      </>
    );
  }

  return (
    <>
      <Layout onLogout={() => { localStorage.removeItem('admin_token'); setIsAuthenticated(false); }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/pools" element={<PoolsPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/fraud" element={<FraudPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
      <Toaster position="top-right" />
    </>
  );
}

export default App;
