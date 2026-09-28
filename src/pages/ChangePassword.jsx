import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Lock, CheckCircle2, ArrowLeft } from "lucide-react";
import { useUserAuth } from "../context/user-auth-hooks.js";
import AuthShell from "../components/layout/AuthShell.jsx";
import BrandHeader from "../components/ui/BrandHeader.jsx";
import FormCard from "../components/ui/FormCard.jsx";
import PasswordField from "../components/ui/PasswordField.jsx";
import Button from "../components/ui/Button.jsx";

export default function ChangePassword() {
  const { user, updatePassword, logout } = useUserAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!user) {
    return <Navigate to="/connexion" replace />;
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

  const handleLogout = () => {
    logout();
    window.location.href = "/connexion";
  };

  if (success) {
    return (
      <AuthShell maxWidth={480}>
        <BrandHeader subtitle="Mot de passe modifié" />
        <FormCard>
          <div className="py-5 text-center">
            <CheckCircle2 size={48} className="mb-4 text-success" />
            <div className="mb-2 text-lg font-semibold text-primary">Votre mot de passe a été mis à jour</div>
            <div className="mb-6 text-[13.5px] text-muted-foreground">Votre nouveau mot de passe est maintenant actif.</div>
            <Button full size="lg" variant="ghost" onClick={handleLogout}>
              <ArrowLeft size={16} /> Se déconnecter
            </Button>
          </div>
        </FormCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell maxWidth={480}>
      <BrandHeader subtitle="Modifier le mot de passe" />
      <FormCard onSubmit={handleSubmit}>
        <div className="mb-5 text-center text-[13.5px] leading-[1.6] text-muted-foreground">
          Saisissez votre nouveau mot de passe.
        </div>
        <PasswordField label="Nouveau mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Au moins 4 caractères" autoComplete="new-password" />
        <PasswordField label="Confirmer le nouveau mot de passe" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirmez le mot de passe" autoComplete="new-password" />
        {error && <div className="mb-3 text-[12.5px] text-warning">{error}</div>}
        <Button full size="lg" type="submit" disabled={loading}>
          <Lock size={16} /> {loading ? "Mise à jour…" : "Enregistrer"}
        </Button>
        <div className="mt-3.5 text-center text-[12.5px] text-muted-foreground">
          <Link to="/test" className="font-semibold text-primary">Retour au test</Link>
        </div>
      </FormCard>
    </AuthShell>
  );
}
