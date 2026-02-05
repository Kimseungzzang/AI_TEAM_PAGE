import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import MainApp from './MainApp';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';

function hasAuthUser() {
  const stored = localStorage.getItem('authUser');
  if (!stored) return false;
  try {
    const parsed = JSON.parse(stored);
    return Boolean(parsed && parsed.id);
  } catch (e) {
    return false;
  }
}

function RequireAuth({ children }) {
  if (!hasAuthUser()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function Main() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={(
            <RequireAuth>
              <MainApp />
            </RequireAuth>
          )}
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default Main;
