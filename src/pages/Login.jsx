import { useState } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { User, LogIn } from "lucide-react";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import { useUserAuth } from "../context/UserAuthContext.jsx";
import AuthShell from "../components/layout/AuthShell.jsx";
import BrandHeader from "../components/ui/BrandHeader.jsx";
import FormCard from "../components/ui/FormCard.jsx";
import Field from "../components/ui/Field.jsx";
import PasswordField from "../components/ui/PasswordField.jsx";
import Button from "../components/ui/Button.jsx";
import { MUTED } from "../lib/theme.js";

export default function Login() {
  const { isAuthenticated, login, loading: authLoading } = useAdminAuth();
  const { hasRole, loading: userLoading } = useUserAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const returnPath = location.state?.from?.pathname;
  const getDefaultRedirect = () => hasRole("super_admin") ? "/super-admin" : "/admin";

  if (authLoading || userLoading) {
    return (
      <AuthShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <div style={{ fontSize: 14, color: MUTED }}>Chargement de votre espace…</div>
        </div>
      </AuthShell>
    );
  }

  if (isAuthenticated) {
    const to = returnPath || getDefaultRedirect();
    return <Navigate to={to} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) {
      // Don't navigate here - let the early return above handle it with correct hasRole
      // The returnUrlRef.current preserves the "return to" URL
    } else {
      setError(res.error);
    }
  };

  return (
    <AuthShell>
      <BrandHeader subtitle="Accès administrateur" />
      <FormCard onSubmit={handleSubmit}>
        <Field label="Email" icon={<User size={16} color={MUTED} />} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" autoFocus autoComplete="email" />
        <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Votre mot de passe" autoComplete="current-password" />
        {error && <div style={{ fontSize: 12.5, color: "#B5652E", marginBottom: 12 }}>{error}</div>}
        <Button full size="lg" type="submit" disabled={loading || authLoading}>
          <LogIn size={16} /> {loading ? "Connexion…" : "Se connecter"}
        </Button>
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 11.5, color: MUTED }}>
          Identifiants gérés via Supabase Auth (rôle admin requis)
        </div>
      </FormCard>
      <div style={{ textAlign: "center", marginTop: 14 }}>
        <Link to="/connexion" style={{ fontSize: 11.5, color: MUTED, textDecoration: "underline" }}>Espace candidats — Passez l'évaluation</Link>
      </div>
      <div style={{ textAlign: "center", marginTop: 14, fontSize: 11.5, color: MUTED }}>
        © NTC Assessment Center — accès réservé
      </div>
    </AuthShell>
  );
}