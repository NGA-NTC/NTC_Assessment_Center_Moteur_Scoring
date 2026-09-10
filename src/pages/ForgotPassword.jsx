import { useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { Mail, RotateCcw } from "lucide-react";
import { useUserAuth } from "../context/UserAuthContext.jsx";
import AuthShell from "../components/layout/AuthShell.jsx";
import BrandHeader from "../components/ui/BrandHeader.jsx";
import FormCard from "../components/ui/FormCard.jsx";
import Field from "../components/ui/Field.jsx";
import Button from "../components/ui/Button.jsx";
import { MUTED, NAVY } from "../lib/theme.js";

export default function ForgotPassword() {
  const { currentUser, resetPassword } = useUserAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  if (currentUser) {
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
        <div style={{ fontSize: 13.5, color: MUTED, marginBottom: 20, textAlign: "center", lineHeight: 1.6 }}>
          Saisissez votre adresse email. Si un compte existe, vous recevrez un lien pour réinitialiser votre mot de passe.
        </div>
        <Field label="Email" icon={<Mail size={16} color={MUTED} />} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" autoFocus autoComplete="email" />
        {error && <div style={{ fontSize: 12.5, color: "#B5652E", marginBottom: 12 }}>{error}</div>}
        {success && <div style={{ fontSize: 12.5, color: "#2E6B3C", marginBottom: 12, background: "#E3F0E4", border: "1px solid #BFE0C4", borderRadius: 8, padding: "10px 14px" }}>{success}</div>}
        <Button full size="lg" type="submit" disabled={loading}>
          <RotateCcw size={16} /> {loading ? "Envoi…" : "Envoyer le lien de réinitialisation"}
        </Button>
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 12.5, color: MUTED }}>
          <Link to="/connexion" style={{ color: NAVY, fontWeight: 600 }}>Retour à la connexion</Link>
        </div>
      </FormCard>
    </AuthShell>
  );
}