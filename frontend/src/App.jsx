import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/common/ProtectedRoute';

import CustomerLayout from './components/customer/CustomerLayout';
import AdminLayout from './components/admin/AdminLayout';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

import HomePage from './pages/customer/HomePage';
import VegetableDetailPage from './pages/customer/VegetableDetailPage';
import CheckoutPage from './pages/customer/CheckoutPage';
import CustomerOrdersPage from './pages/customer/CustomerOrdersPage';
import CustomerOrderDetailPage from './pages/customer/CustomerOrderDetailPage';
import CustomerPaymentsPage from './pages/customer/CustomerPaymentsPage';
import CustomerProfilePage from './pages/customer/CustomerProfilePage';

import DashboardPage from './pages/admin/DashboardPage';
import PurchaseRequirementsPage from './pages/admin/PurchaseRequirementsPage';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import AdminOrderDetailPage from './pages/admin/AdminOrderDetailPage';
import DeliveriesPage from './pages/admin/DeliveriesPage';
import VegetablesPage from './pages/admin/VegetablesPage';
import CategoriesPage from './pages/admin/CategoriesPage';
import InventoryPage from './pages/admin/InventoryPage';
import SuppliersPage from './pages/admin/SuppliersPage';
import SupplierDetailPage from './pages/admin/SupplierDetailPage';
import PurchasesPage from './pages/admin/PurchasesPage';
import AdminPaymentsPage from './pages/admin/AdminPaymentsPage';
import InvoicesPage from './pages/admin/InvoicesPage';
import ExpensesPage from './pages/admin/ExpensesPage';
import UsersPage from './pages/admin/UsersPage';
import UserDetailPage from './pages/admin/UserDetailPage';
import ReportsPage from './pages/admin/ReportsPage';
import AuditLogsPage from './pages/admin/AuditLogsPage';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <BrowserRouter>
            <Routes>
              {/* Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Customer Portal Routes */}
              <Route path="/" element={<CustomerLayout />}>
                <Route index element={<HomePage />} />
                <Route path="vegetables/:id" element={<VegetableDetailPage />} />
                <Route
                  path="checkout"
                  element={
                    <ProtectedRoute>
                      <CheckoutPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="orders"
                  element={
                    <ProtectedRoute>
                      <CustomerOrdersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="orders/:id"
                  element={
                    <ProtectedRoute>
                      <CustomerOrderDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="payments"
                  element={
                    <ProtectedRoute>
                      <CustomerPaymentsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="profile"
                  element={
                    <ProtectedRoute>
                      <CustomerProfilePage />
                    </ProtectedRoute>
                  }
                />
              </Route>

              {/* Admin Console Routes (Strictly ADMIN & SUPER_ADMIN) */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute roles={['ADMIN', 'SUPER_ADMIN']}>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="purchase-requirements" element={<PurchaseRequirementsPage />} />
                <Route path="orders" element={<AdminOrdersPage />} />
                <Route path="orders/:id" element={<AdminOrderDetailPage />} />
                <Route path="deliveries" element={<DeliveriesPage />} />
                <Route path="vegetables" element={<VegetablesPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="suppliers" element={<SuppliersPage />} />
                <Route path="suppliers/:id" element={<SupplierDetailPage />} />
                <Route path="purchases" element={<PurchasesPage />} />
                <Route path="payments" element={<AdminPaymentsPage />} />
                <Route path="invoices" element={<InvoicesPage />} />
                <Route path="expenses" element={<ExpensesPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="users/:id" element={<UserDetailPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="audit-logs" element={<AuditLogsPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </ToastProvider>
  </ThemeProvider>
);
}
