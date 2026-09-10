import { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { supabase } from "../lib/supabaseClient.js";

const UserAuthContext = createContext(null);

export function UserAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const register = useCallback(async (email, password) => {
    if (!email || !email.includes("@")) return { error: "Veuillez saisir un email valide." };
    if (!password || password.length < 4) return { error: "Le mot de passe doit contenir au moins 4 caractères." };

    const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password });
    if (error) return { error: error.message };
    if (data.user && !data.session) {
      return { error: "Un email de confirmation vous a été envoyé. Confirmez votre adresse email avant de vous connecter." };
    }
    return { ok: true };
  }, []);

  const login = useCallback(async (email, password) => {
    if (!email || !password) return { error: "Veuillez saisir votre email et votre mot de passe." };
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) return { error: error.message };
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email) => {
    if (!email || !email.includes("@")) return { error: "Veuillez saisir un email valide." };
    const redirectTo = `${window.location.origin}/reinitialiser-mot-de-passe`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
    if (error) return { error: error.message };
    return { ok: true };
  }, []);

  const updatePassword = useCallback(async (newPassword) => {
    if (!newPassword || newPassword.length < 4) return { error: "Le mot de passe doit contenir au moins 4 caractères." };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: error.message };
    return { ok: true };
  }, []);

  const value = useMemo(() => ({ user, session, loading, register, login, logout, resetPassword, updatePassword }), [
    user, session, loading, register, login, logout, resetPassword, updatePassword
  ]);

  return <UserAuthContext.Provider value={value}>{children}</UserAuthContext.Provider>;
}

export function useUserAuth() {
  const ctx = useContext(UserAuthContext);
  if (!ctx) throw new Error("useUserAuth doit être utilisé dans un UserAuthProvider");
  return ctx;
}