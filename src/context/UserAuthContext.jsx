import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { createAccount, findAccount, isValidEmail } from "../lib/storage.js";

const UserAuthContext = createContext(null);
const SESSION_KEY = "ntc_user_session";

export function UserAuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const email = sessionStorage.getItem(SESSION_KEY);
      return email ? { email } : null;
    } catch {
      return null;
    }
  });

  const register = useCallback(async (email, password) => {
    if (!isValidEmail(email)) return { error: "Veuillez saisir un email valide." };
    const pwd = password || "";
    if (pwd.length < 4) return { error: "Le mot de passe doit contenir au moins 4 caractères." };
    const res = await createAccount(email, pwd);
    if (res.error) return { error: res.error };
    try { sessionStorage.setItem(SESSION_KEY, res.account.email); } catch { /* ignore */ }
    setCurrentUser({ email: res.account.email });
    return { ok: true };
  }, []);

  const login = useCallback(async (email, password) => {
    const account = await findAccount(email, password);
    if (!account) return { error: "Email ou mot de passe incorrect." };
    try { sessionStorage.setItem(SESSION_KEY, account.email); } catch { /* ignore */ }
    setCurrentUser({ email: account.email });
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    setCurrentUser(null);
  }, []);

  const value = useMemo(() => ({ currentUser, register, login, logout }), [currentUser, register, login, logout]);

  return <UserAuthContext.Provider value={value}>{children}</UserAuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUserAuth() {
  const ctx = useContext(UserAuthContext);
  if (!ctx) throw new Error("useUserAuth doit être utilisé dans un UserAuthProvider");
  return ctx;
}