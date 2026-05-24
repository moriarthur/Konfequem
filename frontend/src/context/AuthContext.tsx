import {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
/* eslint-disable react-refresh/only-export-components */
import { API_URL } from "./authConfig";

// --- Types ---

interface TokenPair {
  access: string | null;
  refresh: string | null;
}

interface JWTPayload {
  exp?: number;
  [key: string]: unknown;
}

interface AuthContextValue {
  access: string | null;
  refresh: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<Record<string, unknown>>;
  register: (tokens: { access: string; refresh: string }) => Promise<void>;
  logout: () => Promise<void>;
  authFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
  authFetchRef: React.RefObject<((url: string, options?: RequestInit) => Promise<unknown>) | null>;
  user: Record<string, unknown> | null;
}

// --- Token helpers ---

const TOKEN_STORAGE = {
  get(): TokenPair {
    try {
      return {
        access: localStorage.getItem("access"),
        refresh: localStorage.getItem("refresh"),
      };
    } catch {
      return { access: null, refresh: null };
    }
  },
  set(access: string | null, refresh: string | null) {
    try {
      if (access) localStorage.setItem("access", access);
      else localStorage.removeItem("access");
      if (refresh) localStorage.setItem("refresh", refresh);
      else localStorage.removeItem("refresh");
    } catch {
      // localStorage unavailable (private browsing, quota exceeded)
    }
  },
  clear() {
    try {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
    } catch {
      // localStorage unavailable
    }
  },
};

function parseJWT(token: string): JWTPayload | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(atob(base64));
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  const payload = parseJWT(token);
  if (!payload?.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp - now < 30;
}

// --- Context ---

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<string | null>(null);
  const [refresh, setRefresh] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const refreshPromise = useRef<Promise<Response> | null>(null);
  const userFetchedRef = useRef(false);
  const authFetchRef = useRef<((url: string, options?: RequestInit) => Promise<unknown>) | null>(null);

  const logout = useCallback(async () => {
    const currentRefresh = refresh;
    setAccess(null);
    setRefresh(null);
    setIsAuthenticated(false);
    setUser(null);
    TOKEN_STORAGE.clear();
    userFetchedRef.current = false;

    if (currentRefresh) {
      try {
        await fetch(`${API_URL}/api/token/blacklist/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: currentRefresh }),
        });
      } catch {
        // Best-effort — don't block logout if blacklist fails
      }
    }
  }, [refresh]);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (!refresh) {
      logout();
      return null;
    }

    // If a refresh is already in progress, wait for it
    if (refreshPromise.current) {
      try {
        const res = await refreshPromise.current;
        if (res.ok) {
          const data = await res.json();
          return data.access;
        }
      } catch {
        // Pending refresh failed, fall through to start a new one
      }
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
        if (res.status === 401 || res.status === 403) {
          logout();
        }
        return null;
      }

      const data = await res.json();
      setAccess(data.access);
      const newRefresh = data.refresh || refresh;
      setRefresh(newRefresh);
      TOKEN_STORAGE.set(data.access, newRefresh);
      return data.access;
    } catch (error) {
      refreshPromise.current = null;
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 403) {
        logout();
      }
      return null;
    }
  }, [refresh, logout]);

  const authFetch = useCallback(
    async <T = unknown>(url: string, options: RequestInit = {} as RequestInit): Promise<T> => {
      const opts = { ...options };
      if (!opts.headers) opts.headers = {};
      const headers = opts.headers as Record<string, string>;
      if (access) headers["Authorization"] = `Bearer ${access}`;

      let res: Response;
      try {
        res = await fetch(`${API_URL}${url}`, opts);
      } catch {
        throw new Error("Network error. Please try again.");
      }

      if (res.status === 401) {
        const newAccess = await refreshAccessToken();
        if (!newAccess) throw new Error("Unauthorized");
        headers["Authorization"] = `Bearer ${newAccess}`;
        try {
          res = await fetch(`${API_URL}${url}`, opts);
        } catch {
          throw new Error("Network error. Please try again.");
        }
      }

      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        let errorPayload: Record<string, unknown> = {};
        if (contentType.includes("application/json")) {
          errorPayload = await res.json().catch(() => ({}));
          if (errorPayload.detail) errorPayload.message = errorPayload.detail;
          else if (errorPayload.errors)
            errorPayload.message = Object.values(errorPayload.errors).flat().join("\\n");
        } else {
          const text = await res.text().catch(() => "");
          if (text) errorPayload = { message: text };
        }
        throw { status: res.status, ...errorPayload };
      }

      if (res.status === 204 || res.status === 205) {
        return null as T;
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text().catch(() => "");
        return (text || null) as T;
      }

      return res.json();
    },
    [access, refreshAccessToken]
  );

  useLayoutEffect(() => {
    authFetchRef.current = authFetch;
  }, [authFetch]);

  const fetchUser = useCallback(
    async (tokenParam?: string | null) => {
      const token = tokenParam || access;
      if (!token) {
        setUser(null);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/users/me/`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.status === 401) {
          const newToken = await refreshAccessToken();
          if (!newToken) {
            setUser(null);
            return;
          }
          const retryRes = await fetch(`${API_URL}/api/users/me/`, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${newToken}`,
            },
          });
          if (!retryRes.ok) throw new Error("Failed to fetch user data");
          const data = await retryRes.json();
          setUser(data);
          userFetchedRef.current = true;
          return;
        }

        if (!res.ok) throw new Error("Failed to fetch user data");
        const data = await res.json();
        setUser(data);
      } catch (error) {
        const { error: logError } = await import("../utils/logger");
        logError("Error fetching user:", error);
        if ((error as Error).message?.includes("Failed to fetch user")) {
          setUser(null);
        }
      }
    },
    [access, refreshAccessToken]
  );

  const login = useCallback(
    async (username: string, password: string) => {
      let res: Response;
      try {
        res = await fetch(`${API_URL}/api/token/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
      } catch {
        const networkError = new Error("Network error. Please try again.") as Error & {
          status: string;
        };
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
        const error = new Error(message) as Error & { status: number };
        error.status = res.status;
        throw error;
      }

      const data = await res.json();

      if (!data.access || isTokenExpired(data.access)) {
        throw new Error("Received invalid or expired token");
      }

      setAccess(data.access);
      setRefresh(data.refresh);
      setIsAuthenticated(true);
      TOKEN_STORAGE.set(data.access, data.refresh);
      userFetchedRef.current = true;

      await fetchUser(data.access);

      return data;
    },
    [fetchUser, logout]
  );

  const register = useCallback(
    async (tokens: { access: string; refresh: string }) => {
      if (!tokens.access || isTokenExpired(tokens.access)) {
        throw new Error("Received invalid or expired token");
      }
      setAccess(tokens.access);
      setRefresh(tokens.refresh);
      setIsAuthenticated(true);
      TOKEN_STORAGE.set(tokens.access, tokens.refresh);
      userFetchedRef.current = true;
      await fetchUser(tokens.access);
    },
    [fetchUser]
  );

  useEffect(() => {
    const initializeAuth = async () => {
      const storedTokens = TOKEN_STORAGE.get();
      const storedAccess = storedTokens.access;
      const storedRefresh = storedTokens.refresh;

      const isValidAccess = storedAccess && !isTokenExpired(storedAccess);
      const hasRefresh = storedRefresh && !isTokenExpired(storedRefresh);

      if (isValidAccess) {
        setAccess(storedAccess);
        setRefresh(storedRefresh);
        setIsAuthenticated(true);
        userFetchedRef.current = false;
        setLoading(false);
      } else if (hasRefresh) {
        // refreshAccessToken reads `refresh` from state, but state hasn't
        // been set yet (only the `isValidAccess` branch calls setRefresh).
        // Call the refresh endpoint directly with the stored token.
        try {
          const res = await fetch(`${API_URL}/api/token/refresh/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: storedRefresh }),
          });

          if (res.ok) {
            const data = await res.json();
            setAccess(data.access);
            setRefresh(data.refresh || storedRefresh);
            TOKEN_STORAGE.set(data.access, data.refresh || storedRefresh);
            setIsAuthenticated(true);
          } else {
            logout();
          }
        } catch {
          logout();
        }
        setLoading(false);
      } else {
        setAccess(null);
        setRefresh(null);
        setIsAuthenticated(false);
        setUser(null);
        setLoading(false);
      }
    };

    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (access && isAuthenticated && !user && !userFetchedRef.current) {
      fetchUser(access);
    }
  }, [access, isAuthenticated, user, fetchUser]);

  return (
    <AuthContext.Provider
      value={{ access, refresh, isAuthenticated, loading, login, register, logout, authFetch, authFetchRef, user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
