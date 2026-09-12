import { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { supabase } from "../lib/supabaseClient.js";

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminUser, setAdminUser] = useState(null);

  const checkAdmin = useCallback(async (session) => {
    if (!session?.user) return false;
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role_id")
        .eq("user_id", session.user.id)
        .in("role_id", ["admin", "super_admin"])
        .single();
      return !error && !!data;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      const admin = await checkAdmin(session);
      setIsAuthenticated(admin);
      setAdminUser(admin ? session.user : null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      const admin = await checkAdmin(session);
      setIsAuthenticated(admin);
      setAdminUser(admin ? session.user : null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [checkAdmin]);

  const login = useCallback(async (email, password) => {
    if (!email || !password) return { error: "Veuillez saisir votre email et votre mot de passe." };
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) return { error: error.message };
    const admin = await checkAdmin(data.session);
    if (!admin) {
      await supabase.auth.signOut();
      return { error: "Accès réservé aux administrateurs." };
    }
    return { ok: true };
  }, [checkAdmin]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(() => ({
    isAuthenticated,
    adminUser,
    loading,
    login,
    logout,
  }), [isAuthenticated, adminUser, loading, login, logout]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth doit être utilisé dans un AdminAuthProvider");
  return ctx;
}