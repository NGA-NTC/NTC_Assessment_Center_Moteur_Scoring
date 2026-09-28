import { useState } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { User, LogIn } from "lucide-react";
import { useAdminAuth } from "../context/admin-auth-hooks.js";
import { useUserAuth } from "../context/user-auth-hooks.js";
import AuthShell from "../components/layout/AuthShell.jsx";
import BrandHeader from "../components/ui/BrandHeader.jsx";
import FormCard from "../components/ui/FormCard.jsx";
import Field from "../components/ui/Field.jsx";
import PasswordField from "../components/ui/PasswordField.jsx";
import Button from "../components/ui/Button.jsx";
import { LoadingState } from "../components/ui/States.jsx";

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
        <LoadingState minHeight={340} label="Chargement de votre espace…" />
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
        <Field label="Email" icon={<User size={16} color="var(--muted-foreground)" />} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" autoFocus autoComplete="email" />
        <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Votre mot de passe" autoComplete="current-password" />
        {error && <div className="mb-3 text-[12.5px] text-warning">{error}</div>}
        <Button full size="lg" type="submit" loading={loading} disabled={authLoading || userLoading}>
          <LogIn size={16} /> Se connecter
        </Button>
        <div className="mt-3.5 text-center text-[11.5px] text-muted-foreground">
          Identifiants gérés via Supabase Auth (rôle admin requis)
        </div>
      </FormCard>
      <div className="mt-3.5 text-center">
        <Link to="/connexion" className="text-[11.5px] text-muted-foreground underline">Espace candidats — Passez l'évaluation</Link>
      </div>
      <div className="mt-3.5 text-center text-[11.5px] text-muted-foreground">
        © NTC Assessment Center — accès réservé
      </div>
    </AuthShell>
  );
}
