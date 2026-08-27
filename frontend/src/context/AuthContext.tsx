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
import { useAlert } from "./AlertContext";

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
  const refreshPromise = useRef<Promise<string | null> | null>(null);
  const userFetchedRef = useRef(false);
  const authFetchRef = useRef<((url: string, options?: RequestInit) => Promise<unknown>) | null>(null);
  const lastThrottleToastRef = useRef(0);
  // Bumped on every logout so an in-flight refresh can detect that the
  // session it is refreshing has since ended, and discard its result.
  const logoutEpochRef = useRef(0);
  // Mirror of the current tokens for the `storage` event handler below — a
  // listener registered once would otherwise close over stale state.
  const accessRef = useRef<string | null>(null);
  const refreshRef = useRef<string | null>(null);
  const alert = useAlert();

  const logout = useCallback(async () => {
    logoutEpochRef.current += 1;
    refreshPromise.current = null;
    // Read from storage — the state value may be stale after a rotation
    // in another part of the app, and this keeps the callback stable.
    const currentRefresh = TOKEN_STORAGE.get().refresh;
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
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    // Read from storage — a closure over `refresh` can hold a token that
    // was already rotated and blacklisted by a concurrent refresh.
    const currentRefresh = TOKEN_STORAGE.get().refresh;
    if (!currentRefresh) {
      logout();
      return null;
    }

    // A refresh is already in flight: share its (parsed) result instead of
    // issuing another request. Two parallel refreshes would race under
    // ROTATE_REFRESH_TOKENS and get the second one blacklisted.
    if (refreshPromise.current) return refreshPromise.current;

    const promise = (async (): Promise<string | null> => {
      const epochAtStart = logoutEpochRef.current;
      try {
        const res = await fetch(`${API_URL}/api/token/refresh/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: currentRefresh }),
        });

        if (!res.ok) {
          // Only an invalid/blacklisted token ends the session.
          // 429/5xx are transient — keep the user logged in.
          if (res.status === 401 || res.status === 403) {
            // Under ROTATE+BLACKLIST a 401 here often means another tab
            // already refreshed with this token and got it blacklisted. If
            // storage now holds a different, valid pair, adopt it instead of
            // ending the session for every tab at once.
            const latest = TOKEN_STORAGE.get();
            if (
              latest.access &&
              latest.refresh &&
              latest.refresh !== currentRefresh &&
              !isTokenExpired(latest.access)
            ) {
              refreshPromise.current = null;
              setAccess(latest.access);
              setRefresh(latest.refresh);
              return latest.access;
            }
            logout();
          }
          return null;
        }

        const data = await res.json();

        // A logout may have started while the request was in flight —
        // writing the rotated tokens back would resurrect the session.
        if (epochAtStart !== logoutEpochRef.current) return null;

        const newRefresh = data.refresh || currentRefresh;
        setAccess(data.access);
        setRefresh(newRefresh);
        TOKEN_STORAGE.set(data.access, newRefresh);
        return data.access;
      } catch {
        return null;
      } finally {
        refreshPromise.current = null;
      }
    })();

    refreshPromise.current = promise;
    return promise;
  }, [logout]);

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

      if (res.status === 429) {
        const raw = res.headers.get("Retry-After");
        const seconds = raw && /^\d+$/.test(raw) ? Number(raw) : null;
        // Pages fire several parallel requests — show one toast per burst
        if (Date.now() - lastThrottleToastRef.current > 5000) {
          lastThrottleToastRef.current = Date.now();
          alert.warning(
            seconds
              ? `Too many requests. Please try again in ${seconds}s.`
              : "Too many requests. Please try again shortly."
          );
        }
        throw {
          status: 429,
          retryAfter: seconds ?? undefined,
          message: "Request was throttled.",
        };
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

  useEffect(() => {
    accessRef.current = access;
    refreshRef.current = refresh;
  }, [access, refresh]);

  // Cross-tab sync: a localStorage write in one tab fires a `storage` event
  // in every other tab. Without this, a rotation in tab A leaves tab B holding
  // a refresh token A already rotated+blacklisted — B's next refresh 401s and
  // logs the user out of all tabs at once.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea && e.storageArea !== localStorage) return;
      if (e.key !== null && e.key !== "access" && e.key !== "refresh") return;

      const stored = TOKEN_STORAGE.get();

      // Another tab logged out — mirror it locally. Don't call the blacklist
      // endpoint again: the tab that wrote the removal already did that.
      if (!stored.access && !stored.refresh) {
        if (accessRef.current !== null || refreshRef.current !== null) {
          logoutEpochRef.current += 1;
          refreshPromise.current = null;
          accessRef.current = null;
          refreshRef.current = null;
          setAccess(null);
          setRefresh(null);
          setIsAuthenticated(false);
          setUser(null);
          userFetchedRef.current = false;
        }
        return;
      }

      // Another tab logged in or rotated its tokens — adopt the full snapshot.
      // Rotations write both keys, so the event fires twice; the first event
      // may still see the old refresh value, and the second one converges.
      // The tokens may also belong to a different user than the one this
      // tab's `user` holds — drop it and let the fetch effect refetch.
      if (
        stored.access &&
        (stored.access !== accessRef.current || stored.refresh !== refreshRef.current)
      ) {
        accessRef.current = stored.access;
        refreshRef.current = stored.refresh;
        refreshPromise.current = null;
        setAccess(stored.access);
        setRefresh(stored.refresh);
        setIsAuthenticated(true);
        setUser(null);
        userFetchedRef.current = false;
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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
