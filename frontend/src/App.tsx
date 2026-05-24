import { Suspense, lazy, type ReactNode } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginForm from "./components/LoginForm";
import RegisterForm from "./components/RegisterForm";
import JoinForm from "./components/JoinForm";
import Home from "./pages/Home";
import RoomsPage from "./pages/RoomsPage";
import NotFound from "./pages/NotFound";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AlertProvider } from "./context/AlertContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { CalendarSkeleton, ProfileSkeleton } from "./components/ui/Skeleton";
import LoadingSpinner from "./components/ui/LoadingSpinner";
import "./index.css";

const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));

function PrivateRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-muted gap-4">
        <div className="flex items-center gap-1 animate-pulse">
          <span className="text-2xl font-bold tracking-wide" style={{ color: "#61b390" }}>KONFEQUEM</span>
        </div>
        <LoadingSpinner size="md" />
      </div>
    );
  }
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
              <Route path="/register" element={<RegisterForm />} />
              <Route path="/join/:key" element={<JoinForm />} />
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
                    <LazyRoute fallback={<CalendarSkeleton />}>
                      <CalendarPage />
                    </LazyRoute>
                  </PrivateRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <PrivateRoute>
                    <LazyRoute fallback={<ProfileSkeleton />}>
                      <ProfilePage />
                    </LazyRoute>
                  </PrivateRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
        </AlertProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
