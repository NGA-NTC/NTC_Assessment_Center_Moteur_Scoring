import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Mail, RotateCcw } from "lucide-react";
import { useUserAuth } from "../context/user-auth-hooks.js";
import AuthShell from "../components/layout/AuthShell.jsx";
import BrandHeader from "../components/ui/BrandHeader.jsx";
import FormCard from "../components/ui/FormCard.jsx";
import Field from "../components/ui/Field.jsx";
import Button from "../components/ui/Button.jsx";

export default function ForgotPassword() {
  const { user, resetPassword } = useUserAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/test" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    const res = await resetPassword(email);
    setLoading(false);
    if (res.ok) {
      setSuccess("Si un compte correspond à cette adresse, un email de récupération a été envoyé.");
      setEmail("");
    } else {
      setError(res.error);
    }
  };

  return (
    <AuthShell>
      <BrandHeader subtitle="Mot de passe oublié" />
      <FormCard onSubmit={handleSubmit}>
        <div className="mb-5 text-center text-[13.5px] leading-[1.6] text-muted-foreground">
          Saisissez votre adresse email. Si un compte existe, vous recevrez un lien pour réinitialiser votre mot de passe.
        </div>
        <Field label="Email" icon={<Mail size={16} color="var(--muted-foreground)" />} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" autoFocus autoComplete="email" />
        {error && <div className="mb-3 text-[12.5px] text-warning">{error}</div>}
        {success && <div className="mb-3 rounded-lg border border-success-border bg-success-soft p-2.5 text-[12.5px] text-success">{success}</div>}
        <Button full size="lg" type="submit" disabled={loading}>
          <RotateCcw size={16} /> {loading ? "Envoi…" : "Envoyer le lien de réinitialisation"}
        </Button>
        <div className="mt-3.5 text-center text-[12.5px] text-muted-foreground">
          <Link to="/connexion" className="font-semibold text-primary">Retour à la connexion</Link>
        </div>
      </FormCard>
    </AuthShell>
  );
}
