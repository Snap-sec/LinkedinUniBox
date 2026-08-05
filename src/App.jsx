import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import ChatsPage from './pages/ChatsPage';
import AccountsPage from './pages/AccountsPage';
import LeadsPage from './pages/LeadsPage';
import ListsPage from './pages/ListsPage';
import AddAccountPage from './pages/AddAccountPage';
import DashboardPage from './pages/DashboardPage';

import SettingsPage from './pages/SettingsPage';
import { ToastProvider } from './context/ToastContext';

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Application Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/chats" element={<ProtectedRoute><ChatsPage /></ProtectedRoute>} />
          <Route path="/chats/:id" element={<ProtectedRoute><ChatsPage /></ProtectedRoute>} />
          <Route path="/accounts" element={<ProtectedRoute><AccountsPage /></ProtectedRoute>} />
          <Route path="/leads" element={<ProtectedRoute><LeadsPage /></ProtectedRoute>} />
          <Route path="/lists" element={<ProtectedRoute><ListsPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/accounts/add" element={<ProtectedRoute><AddAccountPage /></ProtectedRoute>} />

          {/* Default redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
