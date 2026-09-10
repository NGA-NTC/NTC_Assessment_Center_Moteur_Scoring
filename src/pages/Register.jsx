import { useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { Mail, UserPlus } from "lucide-react";
import { useUserAuth } from "../context/UserAuthContext.jsx";
import AuthShell from "../components/layout/AuthShell.jsx";
import BrandHeader from "../components/ui/BrandHeader.jsx";
import FormCard from "../components/ui/FormCard.jsx";
import Field from "../components/ui/Field.jsx";
import PasswordField from "../components/ui/PasswordField.jsx";
import Button from "../components/ui/Button.jsx";
import { MUTED, NAVY } from "../lib/theme.js";

export default function Register() {
  const { currentUser, register } = useUserAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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
    if (password !== confirm) { setError("Les deux mots de passe ne correspondent pas."); return; }
    setLoading(true);
    const res = await register(email, password);
    setLoading(false);
    if (res.ok) {
      setSuccess("Compte créé avec succès. Vous pouvez maintenant vous connecter.");
      setEmail("");
      setPassword("");
      setConfirm("");
    } else if (res.error?.includes("confirmation")) {
      setSuccess(res.error);
    } else {
      setError(res.error);
    }
  };

  return (
    <AuthShell>
      <BrandHeader subtitle="Inscription — Passez l'évaluation" />
      <FormCard onSubmit={handleSubmit}>
        <Field label="Email" icon={<Mail size={16} color={MUTED} />} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" autoFocus autoComplete="email" />
        <PasswordField label="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Au moins 4 caractères" autoComplete="new-password" />
        <PasswordField label="Confirmer le mot de passe" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirmez le mot de passe" autoComplete="new-password" />
        {error && <div style={{ fontSize: 12.5, color: "#B5652E", marginBottom: 12 }}>{error}</div>}
        {success && <div style={{ fontSize: 12.5, color: "#2E6B3C", marginBottom: 12, background: "#E3F0E4", border: "1px solid #BFE0C4", borderRadius: 8, padding: "10px 14px" }}>{success}</div>}
        <Button full size="lg" type="submit" disabled={loading}>
          <UserPlus size={16} /> {loading ? "Création…" : "Créer mon compte"}
        </Button>
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 12.5, color: MUTED }}>
          Déjà inscrit ? <Link to="/connexion" style={{ color: NAVY, fontWeight: 600 }}>Se connecter</Link>
        </div>
      </FormCard>
    </AuthShell>
  );
}