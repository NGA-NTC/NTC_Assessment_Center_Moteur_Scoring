import { useState } from "react";
import { Navigate, useNavigate, useLocation, Link } from "react-router-dom";
import { User, LogIn } from "lucide-react";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import AuthShell from "../components/layout/AuthShell.jsx";
import BrandHeader from "../components/ui/BrandHeader.jsx";
import FormCard from "../components/ui/FormCard.jsx";
import Field from "../components/ui/Field.jsx";
import PasswordField from "../components/ui/PasswordField.jsx";
import Button from "../components/ui/Button.jsx";
import { MUTED, NAVY } from "../lib/theme.js";

export default function Login() {
  const { isAuthenticated, login, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) {
      const from = location.state?.from?.pathname || "/admin";
      navigate(from, { replace: true });
    } else {
      setError(res.error);
    }
  };

  if (authLoading) {
    return (
      <AuthShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <div style={{ fontSize: 14, color: MUTED }}>Chargement…</div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <BrandHeader subtitle="Accès administrateur — Résultats" />
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