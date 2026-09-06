import { useState } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { User, LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import AuthShell from "../components/layout/AuthShell.jsx";
import BrandHeader from "../components/ui/BrandHeader.jsx";
import FormCard from "../components/ui/FormCard.jsx";
import Field from "../components/ui/Field.jsx";
import PasswordField from "../components/ui/PasswordField.jsx";
import Button from "../components/ui/Button.jsx";
import { MUTED } from "../lib/theme.js";

export default function Login() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      if (login(username.trim(), password)) {
        const from = location.state?.from?.pathname || "/admin";
        navigate(from, { replace: true });
      } else {
        setError("Identifiant ou mot de passe incorrect.");
        setLoading(false);
      }
    }, 300);
  };

  return (
    <AuthShell>
      <BrandHeader subtitle="Accès administrateur — Résultats" />
      <FormCard onSubmit={handleSubmit}>
        <Field label="Identifiant" icon={<User size={16} color={MUTED} />} type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Votre identifiant" autoFocus autoComplete="username" />
        <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Votre mot de passe" autoComplete="current-password" />
        {error && <div style={{ fontSize: 12.5, color: "#B5652E", marginBottom: 12 }}>{error}</div>}
        <Button full size="lg" type="submit" disabled={loading}>
          <LogIn size={16} /> {loading ? "Connexion…" : "Se connecter"}
        </Button>
        {/* <div style={{ textAlign: "center", marginTop: 14, fontSize: 10.5, color: MUTED }}>
          Identifiants définis dans le fichier <code style={{ color: GOLD }}>.env</code>
        </div> */}
      </FormCard>
      <div style={{ textAlign: "center", marginTop: 18, fontSize: 11.5, color: MUTED }}>
        © NTC Assessment Center — accès réservé
      </div>
    </AuthShell>
  );
}