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
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
  };

  const refreshAccessToken = useCallback(async () => {
    if (!refresh) {
      logout();
      return null;
    }
    try {
      const res = await fetch(`${API_URL}/api/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) {
        logout();
        return null;
      }
      const data = await res.json();
      setAccess(data.access);
      return data.access;
    } catch {
      logout();
      return null;
    }
  }, [refresh]);

  const authFetch = useCallback(
    async (url, options = {}) => {
      if (!options.headers) options.headers = {};
      if (access) options.headers["Authorization"] = `Bearer ${access}`;
      else delete options.headers["Authorization"];

      let res;
      try {
        res = await fetch(`${API_URL}${url}`, options);
      } catch {
        throw new Error("Network error. Please try again.");
      }

      if (res.status === 401) {
        const newAccess = await refreshAccessToken();
        if (!newAccess) throw new Error("Unauthorized");

        options.headers["Authorization"] = `Bearer ${newAccess}`;
        try {
          res = await fetch(`${API_URL}${url}`, options);
        } catch {
          throw new Error("Network error. Please try again.");
        }
      }

      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        let errorPayload = {};
        if (contentType.includes("application/json")) {
          errorPayload = await res.json().catch(() => ({}));
        } else {
          const text = await res.text().catch(() => "");
          if (text) errorPayload = { message: text };
        }
        throw { status: res.status, ...errorPayload };
      }

      return res.json();
    },
    [access, refreshAccessToken]
  );

  const login = async (username, password) => {
    let res;
    try {
      res = await fetch(`${API_URL}/api/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
    } catch {
      throw new Error("Network error. Please try again.");
    }

    if (!res.ok) {
      const contentType = res.headers.get("content-type") || "";
      let message = `Login failed (${res.status})`;

      if (contentType.includes("application/json")) {
        const body = await res.json().catch(() => ({}));
        message =
          body.detail ||
          body.error ||
          (Array.isArray(body.non_field_errors) && body.non_field_errors[0]) ||
          (typeof body.message === "string" && body.message) ||
          message;
      } else {
        const text = await res.text().catch(() => "");
        if (text) message = text;
      }
      throw new Error(message);
    }

    const data = await res.json();
    setAccess(data.access);
    setRefresh(data.refresh);
    setIsAuthenticated(true);
    return data;
  };

  useEffect(() => {
    setIsAuthenticated(!!access);
    setLoading(false);

    if (access) localStorage.setItem("access", access);
    if (refresh) localStorage.setItem("refresh", refresh);
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
