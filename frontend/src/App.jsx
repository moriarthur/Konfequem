import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginForm from "./components/LoginForm";
import Home from "./pages/Home";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { AlertProvider } from "./context/AlertContext";
import './index.css';

/**
 * PrivateRoute component to protect routes.
 * Redirects to login if user is not authenticated.
 */
function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null; 
  return isAuthenticated ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <AuthProvider>
      <AlertProvider>
        <Router future={{ v7_startTransition: true }}>
          <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Home />
                </PrivateRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </AlertProvider>
    </AuthProvider>
  );
}
