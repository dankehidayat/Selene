import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
  createdAt?: string;
  totpEnabled?: boolean;
}

export interface LoginEntry {
  id: string;
  ip: string;
  userAgent: string;
  createdAt: string;
}

export type LoginResult =
  | { status: "ok" }
  | { status: "2fa"; pendingToken: string };

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  complete2fa: (pendingToken: string, code: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  /** Apply a new JWT (e.g. after password change on this device). */
  setSessionToken: (token: string, user?: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
const SESSION_CHECK_MS = 12_000;

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("token"),
  );
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }, []);

  const applySession = useCallback((t: string, u: User) => {
    localStorage.setItem("token", t);
    setToken(t);
    setUser(u);
  }, []);

  const setSessionToken = useCallback(
    (t: string, u?: User) => {
      localStorage.setItem("token", t);
      setToken(t);
      if (u) setUser(u);
    },
    [],
  );

  const refreshUser = useCallback(async () => {
    const t = localStorage.getItem("token");
    if (!t) {
      setUser(null);
      return;
    }
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (res.status === 401) {
      clearSession();
      return;
    }
    const data = await res.json();
    if (data.user) setUser(data.user);
  }, [clearSession]);

  const validateSession = useCallback(async () => {
    const t = localStorage.getItem("token");
    if (!t) return;
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 401) {
        clearSession();
        return;
      }
      const data = await res.json();
      if (data.user) setUser(data.user);
      else clearSession();
    } catch {
      /* network blip — keep session */
    }
  }, [clearSession]);

  // Initial load
  useEffect(() => {
    if (token) {
      fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (res) => {
          if (res.status === 401) {
            clearSession();
            return null;
          }
          return res.json();
        })
        .then((data) => {
          if (data?.user) setUser(data.user);
          else if (data) clearSession();
        })
        .catch(() => {
          clearSession();
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token, clearSession]);

  // Poll + focus check so password reset on another device lands everyone on login
  useEffect(() => {
    if (!token) return;

    const id = window.setInterval(() => {
      void validateSession();
    }, SESSION_CHECK_MS);

    const onVis = () => {
      if (document.visibilityState === "visible") void validateSession();
    };
    const onFocus = () => void validateSession();

    // Cross-tab logout when token is cleared elsewhere
    const onStorage = (e: StorageEvent) => {
      if (e.key === "token" && !e.newValue) {
        setToken(null);
        setUser(null);
      }
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [token, validateSession]);

  const login = async (
    email: string,
    password: string,
  ): Promise<LoginResult> => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");

    if (data.requires2fa && data.pendingToken) {
      return { status: "2fa", pendingToken: data.pendingToken };
    }

    applySession(data.token, data.user);
    return { status: "ok" };
  };

  const complete2fa = async (pendingToken: string, code: string) => {
    const res = await fetch(`${API_BASE}/auth/login/2fa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pendingToken, code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "2FA verification failed");
    applySession(data.token, data.user);
  };

  const register = async (email: string, password: string, name?: string) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");
    applySession(data.token, data.user);
  };

  const logout = () => {
    clearSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        complete2fa,
        register,
        logout,
        refreshUser,
        setSessionToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

export function useLoginHistory() {
  const { token } = useAuth();
  const [history, setHistory] = useState<LoginEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/auth/login-history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.history) setHistory(data.history);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return { history, loading };
}
