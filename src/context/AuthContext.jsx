import { createContext, useContext, useState, useCallback, useMemo } from "react";

const AuthContext = createContext(null);

const AUTH_KEY = "ntc_auth";

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return sessionStorage.getItem(AUTH_KEY) === "true";
    } catch {
      return false;
    }
  });

  const login = useCallback((username, password) => {
    const expectedUser = import.meta.env.VITE_AUTH_USERNAME;
    const expectedPass = import.meta.env.VITE_AUTH_PASSWORD;
    if (username === expectedUser && password === expectedPass) {
      try {
        sessionStorage.setItem(AUTH_KEY, "true");
      } catch {
        /* stockage indisponible : session non persistée */
      }
      setIsAuthenticated(true);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(AUTH_KEY);
    } catch {
      /* ignore */
    }
    setIsAuthenticated(false);
  }, []);

  const value = useMemo(() => ({ isAuthenticated, login, logout }), [isAuthenticated, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans un AuthProvider");
  return ctx;
}