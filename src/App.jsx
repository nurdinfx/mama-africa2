import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/login';
import Dashboard from './pages/dashboard';
import POS from './pages/pos';
import Kitchen from './pages/kitchen';
import Orders from './pages/orders';
import Inventory from './pages/inventory';
import CustomerLedger from './pages/customer-ledger';
import Finance from './pages/finance';
import Settings from './pages/settings';
import Users from './pages/users';
import Tables from './pages/tables';
import Purchase from './pages/purchase'; // FIXED: This file should be .jsx
import Reports from './pages/reports';
import CustomerDisplay from './pages/customer-display';
import CashierHandoverReport from './pages/cashier-handover-report';

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <div className="App">
            <Routes>
              <Route path="/login" element={<Login />} />

              {/* Protected routes with layout */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/dashboard" replace />} />

                <Route path="dashboard" element={<Dashboard />} />

                {/* POS Route moved out to be full screen */}

                <Route path="kitchen" element={
                  <ProtectedRoute requiredRoles={['admin', 'chef']}>
                    <Kitchen />
                  </ProtectedRoute>
                } />

                <Route path="orders" element={
                  <ProtectedRoute requiredRoles={['admin', 'manager', 'cashier']}>
                    <Orders />
                  </ProtectedRoute>
                } />

                <Route path="tables" element={
                  <ProtectedRoute requiredRoles={['admin', 'manager', 'waiter']}>
                    <Tables />
                  </ProtectedRoute>
                } />

                <Route path="inventory" element={
                  <ProtectedRoute requiredRoles={['admin', 'manager']}>
                    <Inventory />
                  </ProtectedRoute>
                } />

                <Route path="customers" element={
                  <ProtectedRoute requiredRoles={['admin', 'manager', 'cashier']}>
                    <CustomerLedger />
                  </ProtectedRoute>
                } />

                <Route path="customers/ledger" element={
                  <ProtectedRoute requiredRoles={['admin', 'manager', 'cashier']}>
                    <CustomerLedger />
                  </ProtectedRoute>
                } />

                <Route path="finance" element={
                  <ProtectedRoute requiredRoles={['admin', 'manager']}>
                    <Finance />
                  </ProtectedRoute>
                } />

                {/* ADD PURCHASE ROUTE */}
                <Route path="purchase" element={
                  <ProtectedRoute requiredRoles={['admin', 'manager']}>
                    <Purchase />
                  </ProtectedRoute>
                } />

                <Route path="reports" element={
                  <ProtectedRoute requiredRoles={['admin', 'manager']}>
                    <Reports />
                  </ProtectedRoute>
                } />

                <Route path="reports/cashier-handover" element={
                  <ProtectedRoute requiredRoles={['admin', 'manager']}>
                    <CashierHandoverReport />
                  </ProtectedRoute>
                } />

                <Route path="settings" element={
                  <ProtectedRoute requiredRoles={['admin', 'manager']}>
                    <Settings />
                  </ProtectedRoute>
                } />

                <Route path="users" element={
                  <ProtectedRoute requiredRoles={['admin', 'manager']}>
                    <Users />
                  </ProtectedRoute>
                } />
              </Route>

              {/* Full Screen POS Route - Waiters need access too */}
              <Route path="/pos" element={
                <ProtectedRoute requiredRoles={['admin', 'manager', 'cashier', 'waiter']}>
                  <POS />
                </ProtectedRoute>
              } />

              {/* Customer Display Route (Second Screen) */}
              <Route path="/customer-view" element={<CustomerDisplay />} />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
