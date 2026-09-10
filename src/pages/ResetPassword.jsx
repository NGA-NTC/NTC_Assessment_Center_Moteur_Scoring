import { useState, useEffect } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { Lock, CheckCircle2 } from "lucide-react";
import { useUserAuth } from "../context/UserAuthContext.jsx";
import AuthShell from "../components/layout/AuthShell.jsx";
import BrandHeader from "../components/ui/BrandHeader.jsx";
import FormCard from "../components/ui/FormCard.jsx";
import PasswordField from "../components/ui/PasswordField.jsx";
import Button from "../components/ui/Button.jsx";
import { MUTED, NAVY } from "../lib/theme.js";

export default function ResetPassword() {
  const { currentUser, updatePassword } = useUserAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (currentUser) {
    return <Navigate to="/test" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Les deux mots de passe ne correspondent pas."); return; }
    if (password.length < 4) { setError("Le mot de passe doit contenir au moins 4 caractères."); return; }
    setLoading(true);
    const res = await updatePassword(password);
    setLoading(false);
    if (res.ok) {
      setSuccess(true);
      setPassword("");
      setConfirm("");
    } else {
      setError(res.error);
    }
  };

  if (success) {
    return (
      <AuthShell>
        <BrandHeader subtitle="Mot de passe réinitialisé" />
        <FormCard>
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <CheckCircle2 size={48} color="#2E6B3C" style={{ marginBottom: 16 }} />
            <div style={{ fontSize: 18, fontWeight: 600, color: "#1B2A4A", marginBottom: 8 }}>Votre mot de passe a été mis à jour</div>
            <div style={{ fontSize: 13.5, color: MUTED, marginBottom: 24 }}>Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</div>
            <Button full size="lg" onClick={() => navigate("/connexion", { replace: true })}>
              <Lock size={16} /> Se connecter
            </Button>
          </div>
        </FormCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <BrandHeader subtitle="Réinitialiser le mot de passe" />
      <FormCard onSubmit={handleSubmit}>
        <div style={{ fontSize: 13.5, color: MUTED, marginBottom: 20, textAlign: "center", lineHeight: 1.6 }}>
          Définissez votre nouveau mot de passe.
        </div>
        <PasswordField label="Nouveau mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Au moins 4 caractères" autoComplete="new-password" />
        <PasswordField label="Confirmer le nouveau mot de passe" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirmez le mot de passe" autoComplete="new-password" />
        {error && <div style={{ fontSize: 12.5, color: "#B5652E", marginBottom: 12 }}>{error}</div>}
        <Button full size="lg" type="submit" disabled={loading}>
          <Lock size={16} /> {loading ? "Mise à jour…" : "Enregistrer le nouveau mot de passe"}
        </Button>
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 12.5, color: MUTED }}>
          <Link to="/connexion" style={{ color: NAVY, fontWeight: 600 }}>Annuler</Link>
        </div>
      </FormCard>
    </AuthShell>
  );
}