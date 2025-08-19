import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext();

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

export function AuthProvider({ children }) {
  const [access, setAccess] = useState(localStorage.getItem("access") || null);
  const [refresh, setRefresh] = useState(localStorage.getItem("refresh") || null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!access);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    setAccess(null);
    setRefresh(null);
    setIsAuthenticated(false);
  };

  const refreshAccessToken = useCallback(async () => {
    if (!refresh) {
      logout();
      return false;
    }
    try {
      const res = await fetch(`${API_URL}/api/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) {
        logout();
        return false;
      }
      const data = await res.json();
      setAccess(data.access);
      return true;
    } catch {
      logout();
      return false;
    }
  }, [refresh]);

  const authFetch = useCallback(
    async (url, options = {}) => {
      if (!options.headers) options.headers = {};
      options.headers["Authorization"] = `Bearer ${access}`;

      let res = await fetch(`${API_URL}${url}`, options);

      if (res.status === 401) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) throw new Error("Unauthorized");
        options.headers["Authorization"] = `Bearer ${access}`;
        res = await fetch(`${API_URL}${url}`, options);
      }

      if (!res.ok) {
        const error = await res.json();
        throw error;
      }
      return res.json();
    },
    [access, refreshAccessToken]
  );

  const login = async (username, password) => {
    const res = await fetch(`${API_URL}/api/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error("Invalid credentials");
    const data = await res.json();
    setAccess(data.access);
    setRefresh(data.refresh);
    setIsAuthenticated(true);
  };

  useEffect(() => {
    if (access) localStorage.setItem("access", access);
    else localStorage.removeItem("access");

    if (refresh) localStorage.setItem("refresh", refresh);
    else localStorage.removeItem("refresh");

    setIsAuthenticated(!!access);
    setLoading(false);
  }, [access, refresh]);

  return (
    <AuthContext.Provider value={{ access, refresh, isAuthenticated, loading, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
