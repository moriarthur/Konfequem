import { Suspense, lazy, type ReactNode } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginForm from "./components/LoginForm";
import Home from "./pages/Home";
import RoomsPage from "./pages/RoomsPage";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AlertProvider } from "./context/AlertContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { PageHeaderSkeleton } from "./components/ui/Skeleton";
import "./index.css";

const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));

function PrivateRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function LazyRoute({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

export default function App() {
  return (
    <ErrorBoundary>
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
              <Route
                path="/rooms"
                element={
                  <PrivateRoute>
                    <RoomsPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/calendar"
                element={
                  <PrivateRoute>
                    <LazyRoute fallback={<PageHeaderSkeleton />}>
                      <CalendarPage />
                    </LazyRoute>
                  </PrivateRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <PrivateRoute>
                    <LazyRoute fallback={<PageHeaderSkeleton />}>
                      <ProfilePage />
                    </LazyRoute>
                  </PrivateRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Router>
        </AlertProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
