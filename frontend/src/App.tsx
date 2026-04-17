/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Reservoirs from './pages/Reservoirs';
import TaskManagement from './pages/TaskManagement';
import UserDirectory from './pages/UserDirectory';
import SystemLogs from './pages/SystemLogs';
import UploadTest from './pages/UploadTest';
import Login from './pages/Login';
import { api } from './services/api';

function ProtectedRoute() {
  if (!api.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={api.isAuthenticated() ? <Navigate to="/" replace /> : <Login />}
        />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="reservoirs" element={<Reservoirs />} />
            <Route path="tasks" element={<TaskManagement />} />
            <Route path="users" element={<UserDirectory />} />
            <Route path="logs" element={<SystemLogs />} />
            <Route path="upload-test" element={<UploadTest />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
