import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Kitchen from './pages/Kitchen';
import Orders from './pages/Orders';
import Inventory from './pages/Inventory';
import CustomerLedger from './pages/CustomerLedger';
import Finance from './pages/Finance';
import Settings from './pages/Settings';
import Users from './pages/Users';
import Tables from './pages/Tables';
import Purchase from './pages/Purchase'; // FIXED: This file should be .jsx
import Reports from './pages/Reports';
import CashierHandoverReport from './pages/CashierHandoverReport';

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
                
                <Route path="pos" element={
                  <ProtectedRoute requiredRoles={['admin', 'manager', 'cashier', 'waiter']}>
                    <POS />
                  </ProtectedRoute>
                } />
                
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
              
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
