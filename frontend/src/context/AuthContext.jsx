import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

export function AuthProvider({ children }) {
  const [access, setAccess] = useState(localStorage.getItem("access") || null);
  const [refresh, setRefresh] = useState(localStorage.getItem("refresh") || null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!access);

  useEffect(() => {
    if (access) localStorage.setItem("access", access);
    else localStorage.removeItem("access");

    if (refresh) localStorage.setItem("refresh", refresh);
    else localStorage.removeItem("refresh");

    setIsAuthenticated(!!access);
  }, [access, refresh]);

  const login = async (username, password) => {
    const res = await fetch(`${API_URL}/api/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      throw new Error("Invalid credentials");
    }

    const data = await res.json();
    setAccess(data.access);
    setRefresh(data.refresh);
  };

  const logout = () => {
    setAccess(null);
    setRefresh(null);
  };

  const refreshAccessToken = async () => {
    if (!refresh) {
      logout();
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });

      if (!res.ok) {
        logout();
        return;
      }

      const data = await res.json();
      setAccess(data.access);
    } catch {
      logout();
    }
  };

  const authFetch = async (url, options = {}) => {
    if (!options.headers) options.headers = {};
    options.headers["Authorization"] = `Bearer ${access}`;

    let res = await fetch(`${API_URL}${url}`, options);

    if (res.status === 401) {
      await refreshAccessToken();

      if (!access) throw new Error("Unauthorized");

      options.headers["Authorization"] = `Bearer ${access}`;
      res = await fetch(`${API_URL}${url}`, options);
    }

    if (!res.ok) {
      const error = await res.json();
      throw error;
    }

    return res.json();
  };

  return (
    <AuthContext.Provider
      value={{ access, refresh, isAuthenticated, login, logout, authFetch }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
