import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
/*
  The react-refresh ESLint rule (only-export-components) can warn when a file
  exports hooks/constants alongside components which breaks Fast Refresh.
  We moved non-component constants to `authConfig.js`. Keep this file focused
  on the AuthProvider component and hook. Disable the rule here to avoid a
  noisy warning in development.
*/
/* eslint-disable react-refresh/only-export-components */
import { API_URL } from "./authConfig";

// Token management helpers
const TOKEN_STORAGE = {
  get: () => {
    try {
      return {
        access: localStorage.getItem("access"),
        refresh: localStorage.getItem("refresh"),
      };
    } catch {
      return { access: null, refresh: null };
    }
  },
  set: (access, refresh) => {
    try {
      if (access) localStorage.setItem("access", access);
      else localStorage.removeItem("access");
      if (refresh) localStorage.setItem("refresh", refresh);
      else localStorage.removeItem("refresh");
    } catch (e) {
      console.error("Failed to store tokens:", e);
    }
  },
  clear: () => {
    try {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
    } catch (e) {
      console.error("Failed to clear tokens:", e);
    }
  },
};

// Simple JWT parser (for expiration checking)
function parseJWT(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64));
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// Check if token is expired (actually expired, not "will expire soon")
function isTokenExpired(token) {
  if (!token) return true;
  const payload = parseJWT(token);
  if (!payload || !payload.exp) return true;

  const now = Math.floor(Date.now() / 1000);
  // Consider expired only if actually expired (exp time has passed)
  // Add 30 second buffer to account for clock skew
  return payload.exp - now < 30;
}

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [access, setAccess] = useState(null);
  const [refresh, setRefresh] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const refreshPromise = useRef(null);
  // Track if we've already fetched user for current access token to prevent duplicate fetches
  const userFetchedRef = useRef(false);

  const logout = useCallback(() => {
    setAccess(null);
    setRefresh(null);
    setIsAuthenticated(false);
    setUser(null);
    TOKEN_STORAGE.clear();
    // Reset the user fetched flag so logging in again works properly
    userFetchedRef.current = false;
  }, []);

  const refreshAccessToken = useCallback(async () => {
    // Prevent concurrent refresh attempts
    if (!refresh || refreshPromise.current) {
      if (!refresh) logout();
      return null;
    }

    try {
      refreshPromise.current = fetch(`${API_URL}/api/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });

      const res = await refreshPromise.current;
      refreshPromise.current = null;

      if (!res.ok) {
        // Only logout on authentication failures, not network errors
        if (res.status === 401 || res.status === 403) {
          logout();
        }
        return null;
      }

      const data = await res.json();
      setAccess(data.access);
      // Handle rotated refresh tokens (backend may return new refresh token)
      const newRefresh = data.refresh || refresh;
      setRefresh(newRefresh);
      TOKEN_STORAGE.set(data.access, newRefresh);
      return data.access;
    } catch (error) {
      // Only logout on authentication errors, not network errors
      const status = error?.status;
      if (status === 401 || status === 403) {
        logout();
      }
      return null;
    }
  }, [refresh, logout]);

  const authFetch = useCallback(
    async (url, options = {}) => {
      if (!options.headers) options.headers = {};
      if (access) options.headers["Authorization"] = `Bearer ${access}`;

      let res;
      try { res = await fetch(`${API_URL}${url}`, options); } 
      catch { throw new Error("Network error. Please try again."); }

      if (res.status === 401) {
        const newAccess = await refreshAccessToken();
        if (!newAccess) throw new Error("Unauthorized");
        options.headers["Authorization"] = `Bearer ${newAccess}`;
        try { res = await fetch(`${API_URL}${url}`, options); } 
        catch { throw new Error("Network error. Please try again."); }
      }

      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        let errorPayload = {};
        if (contentType.includes("application/json")) {
          errorPayload = await res.json().catch(() => ({}));
          if (errorPayload.detail) errorPayload.message = errorPayload.detail;
          else if (errorPayload.errors) errorPayload.message = Object.values(errorPayload.errors).flat().join("\n");
        } else {
          const text = await res.text().catch(() => "");
          if (text) errorPayload = { message: text };
        }
        throw { status: res.status, ...errorPayload };
      }

      if (res.status === 204 || res.status === 205) {
        return null;
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text().catch(() => "");
        return text || null;
      }

      return res.json();
    },
    [access, refreshAccessToken]
  );

  const fetchUser = useCallback(
    async (tokenParam) => {
      const token = tokenParam || access;
      if (!token) {
        setUser(null);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/users/me/`, {
          headers: { 
            "Content-Type": "application/json", 
            "Authorization": `Bearer ${token}` 
          },
        });

        if (res.status === 401) {
          const newToken = await refreshAccessToken();
          if (!newToken) {
            setUser(null);
            return;
          }
          // Retry with new token
          const retryRes = await fetch(`${API_URL}/api/users/me/`, {
            headers: { 
              "Content-Type": "application/json", 
              "Authorization": `Bearer ${newToken}` 
            },
          });
          if (!retryRes.ok) throw new Error("Failed to fetch user data");
          const data = await retryRes.json();
          setUser(data);
          // Mark that we've successfully fetched user for this access token
          userFetchedRef.current = true;
          return;
        }

        if (!res.ok) throw new Error("Failed to fetch user data");
        const data = await res.json();
        setUser(data);
      } catch (error) {
        // Use centralized logger (no-op in production)
        // import locally to avoid circular module issues during HMR
        const { error: logError } = await import("../utils/logger");
        logError("Error fetching user:", error);
        // Only clear user if it's an auth error
        if (error.message && error.message.includes("Failed to fetch user")) {
          setUser(null);
        }
      }
    },
    [access, refreshAccessToken]
  );

  const login = useCallback(async (username, password) => {
    let res;
    try {
      res = await fetch(`${API_URL}/api/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
    } catch {
      const networkError = new Error("Network error. Please try again.");
      networkError.status = "network";
      throw networkError;
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
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }

    const data = await res.json();

    // Validate JWT before storing
    if (!data.access || isTokenExpired(data.access)) {
      throw new Error("Received invalid or expired token");
    }

    setAccess(data.access);
    setRefresh(data.refresh);
    setIsAuthenticated(true);
    TOKEN_STORAGE.set(data.access, data.refresh);
    // Mark that we've fetched user for this access token
    userFetchedRef.current = true;

    await fetchUser(data.access);

    return data;
  }, [fetchUser, logout]);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      const storedTokens = TOKEN_STORAGE.get();
      const access = storedTokens.access;
      const refresh = storedTokens.refresh;

      // Validate tokens before using
      const isValidAccess = access && !isTokenExpired(access);
      const hasRefresh = refresh && !isTokenExpired(refresh);

      if (isValidAccess) {
        setAccess(access);
        setRefresh(refresh);
        setIsAuthenticated(true);
        // Set user fetched flag synchronously to prevent race condition
        userFetchedRef.current = false;
        // Fetch user will be triggered by the second useEffect when access changes
        setLoading(false);
      } else if (hasRefresh) {
        // Access token expired but refresh is valid - try to refresh
        const newAccess = await refreshAccessToken();
        if (newAccess) {
          setIsAuthenticated(true);
          // User fetch will be triggered by the second useEffect
        } else {
          // Refresh failed - clear state
          logout();
        }
        setLoading(false);
      } else {
        // No valid tokens - clear state and set loading to false
        setAccess(null);
        setRefresh(null);
        setIsAuthenticated(false);
        setUser(null);
        setLoading(false);
      }
    };

    initializeAuth();
  }, []); // Run once on mount

  // Fetch user when access changes and we're authenticated
  useEffect(() => {
    if (access && isAuthenticated && !user && !userFetchedRef.current) {
      fetchUser(access);
    }
  }, [access, isAuthenticated, user]); // fetchUser is stable - defined with useCallback and only depends on access/refreshAccessToken

  return (
    <AuthContext.Provider value={{ access, refresh, isAuthenticated, loading, login, logout, authFetch, user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
