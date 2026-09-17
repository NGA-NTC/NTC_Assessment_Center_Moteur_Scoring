import { useState } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { Mail, LogIn } from "lucide-react";
import { useUserAuth } from "../context/UserAuthContext.jsx";
import AuthShell from "../components/layout/AuthShell.jsx";
import BrandHeader from "../components/ui/BrandHeader.jsx";
import FormCard from "../components/ui/FormCard.jsx";
import Field from "../components/ui/Field.jsx";
import PasswordField from "../components/ui/PasswordField.jsx";
import Button from "../components/ui/Button.jsx";
import { MUTED, NAVY } from "../lib/theme.js";

export default function UserLogin() {
  const { user, login, loading: authLoading, hasRole } = useUserAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const returnPath = location.state?.from?.pathname;
  const getDefaultRedirect = () => hasRole("super_admin") ? "/super-admin" : "/test";

  if (authLoading) {
    return (
      <AuthShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <div style={{ fontSize: 14, color: MUTED }}>Chargement de votre espace…</div>
        </div>
      </AuthShell>
    );
  }

  if (user) {
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
    } else {
      setError(res.error);
    }
  };

  return (
    <AuthShell>
      <BrandHeader subtitle="Connexion — Accès à l'évaluation" />
      <FormCard onSubmit={handleSubmit}>
        <Field label="Email" icon={<Mail size={16} color={MUTED} />} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" autoFocus autoComplete="email" />
        <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Votre mot de passe" autoComplete="current-password" />
        {error && <div style={{ fontSize: 12.5, color: "#B5652E", marginBottom: 12 }}>{error}</div>}
        <Button full size="lg" type="submit" disabled={loading}>
          <LogIn size={16} /> {loading ? "Connexion…" : "Se connecter"}
        </Button>
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 12.5, color: MUTED }}>
          Pas encore de compte ? <Link to="/inscription" style={{ color: NAVY, fontWeight: 600 }}>S'inscrire</Link>
        </div>
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <Link to="/mot-de-passe-oublie" style={{ fontSize: 11.5, color: MUTED, textDecoration: "underline" }}>Mot de passe oublié ?</Link>
        </div>
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <Link to="/login" style={{ fontSize: 11.5, color: MUTED, textDecoration: "underline" }}>Espace administrateur</Link>
        </div>
      </FormCard>
    </AuthShell>
  );
}