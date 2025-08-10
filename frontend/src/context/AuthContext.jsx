import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [access, setAccess] = useState(localStorage.getItem("access") || null);
  const [refresh, setRefresh] = useState(localStorage.getItem("refresh") || null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!access);

  // Сохраняем токены в localStorage при изменении
  useEffect(() => {
    if (access) localStorage.setItem("access", access);
    else localStorage.removeItem("access");

    if (refresh) localStorage.setItem("refresh", refresh);
    else localStorage.removeItem("refresh");

    setIsAuthenticated(!!access);
  }, [access, refresh]);

  // Функция логина
  const login = async (username, password) => {
    const res = await fetch("http://127.0.0.1:8000/api/token/", {
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

  // Функция логаута
  const logout = () => {
    setAccess(null);
    setRefresh(null);
  };

  // Обновление access токена с помощью refresh
  const refreshAccessToken = async () => {
    if (!refresh) {
      logout();
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/api/token/refresh/", {
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

  // Обёртка fetch с автоматической подстановкой access токена
  const authFetch = async (url, options = {}) => {
    if (!options.headers) options.headers = {};
    options.headers["Authorization"] = `Bearer ${access}`;

    let res = await fetch(url, options);

    if (res.status === 401) {
      // Попытка обновить токен и повторить запрос
      await refreshAccessToken();

      if (!access) throw new Error("Unauthorized");

      options.headers["Authorization"] = `Bearer ${access}`;
      res = await fetch(url, options);
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

// Хук для удобного доступа к AuthContext
export function useAuth() {
  return useContext(AuthContext);
}
