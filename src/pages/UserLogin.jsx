import { useState } from "react";
import { Navigate, useNavigate, useLocation, Link } from "react-router-dom";
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
  const { currentUser, login } = useUserAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (currentUser) {
    return <Navigate to="/test" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) {
      const from = location.state?.from?.pathname || "/test";
      navigate(from, { replace: true });
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
      </FormCard>
      <div style={{ textAlign: "center", marginTop: 14 }}>
        <Link to="/login" style={{ fontSize: 11.5, color: MUTED, textDecoration: "underline" }}>Espace administrateur (résultats)</Link>
      </div>
    </AuthShell>
  );
}