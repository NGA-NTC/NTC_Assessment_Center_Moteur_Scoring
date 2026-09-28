import { useState } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { Mail, LogIn } from "lucide-react";
import { useUserAuth } from "../context/user-auth-hooks.js";
import AuthShell from "../components/layout/AuthShell.jsx";
import BrandHeader from "../components/ui/BrandHeader.jsx";
import FormCard from "../components/ui/FormCard.jsx";
import Field from "../components/ui/Field.jsx";
import PasswordField from "../components/ui/PasswordField.jsx";
import Button from "../components/ui/Button.jsx";
import { LoadingState } from "../components/ui/States.jsx";

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
        <LoadingState minHeight={340} label="Chargement de votre espace…" />
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
        <Field label="Email" icon={<Mail size={16} color="var(--muted-foreground)" />} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" autoFocus autoComplete="email" />
        <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Votre mot de passe" autoComplete="current-password" />
        {error && <div className="mb-3 text-[12.5px] text-warning">{error}</div>}
        <Button full size="lg" type="submit" loading={loading}>
          <LogIn size={16} /> Se connecter
        </Button>
        <div className="mt-3.5 text-center text-[12.5px] text-muted-foreground">
          Pas encore de compte ? <Link to="/inscription" className="font-semibold text-primary">S'inscrire</Link>
        </div>
        <div className="mt-3.5 text-center">
          <Link to="/mot-de-passe-oublie" className="text-[11.5px] text-muted-foreground underline">Mot de passe oublié ?</Link>
        </div>
        <div className="mt-3.5 text-center">
          <Link to="/login" className="text-[11.5px] text-muted-foreground underline">Espace administrateur</Link>
        </div>
      </FormCard>
    </AuthShell>
  );
}
