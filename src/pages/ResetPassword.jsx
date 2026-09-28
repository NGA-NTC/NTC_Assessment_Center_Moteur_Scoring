import { useState, useEffect } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { Lock, CheckCircle2 } from "lucide-react";
import { useUserAuth } from "../context/user-auth-hooks.js";
import { supabase } from "../lib/supabaseClient.js";
import AuthShell from "../components/layout/AuthShell.jsx";
import BrandHeader from "../components/ui/BrandHeader.jsx";
import FormCard from "../components/ui/FormCard.jsx";
import PasswordField from "../components/ui/PasswordField.jsx";
import Button from "../components/ui/Button.jsx";

export default function ResetPassword() {
  const { user, updatePassword } = useUserAuth();
  const navigate = useNavigate();
  // Un lien de réinitialisation Supabase arrive en `type=recovery` dans l'URL :
  // la session de récupération est détectée à la fois par la présence du paramètre
  // et par l'événement PASSWORD_RECOVERY (pour couvrir le nettoyage de l'URL par le client).
  const [recovery, setRecovery] = useState(() => {
    const raw = window.location.hash.slice(1) || window.location.search.slice(1);
    return new URLSearchParams(raw).get("type") === "recovery";
  });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (user && !recovery) {
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
          <div className="py-5 text-center">
            <CheckCircle2 size={48} className="mb-4 text-success" />
            <div className="mb-2 text-lg font-semibold text-primary">Votre mot de passe a été mis à jour</div>
            <div className="mb-6 text-[13.5px] text-muted-foreground">Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</div>
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
        <div className="mb-5 text-center text-[13.5px] leading-[1.6] text-muted-foreground">
          Définissez votre nouveau mot de passe.
        </div>
        <PasswordField label="Nouveau mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Au moins 4 caractères" autoComplete="new-password" />
        <PasswordField label="Confirmer le nouveau mot de passe" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirmez le mot de passe" autoComplete="new-password" />
        {error && <div className="mb-3 text-[12.5px] text-warning">{error}</div>}
        <Button full size="lg" type="submit" disabled={loading}>
          <Lock size={16} /> {loading ? "Mise à jour…" : "Enregistrer le nouveau mot de passe"}
        </Button>
        <div className="mt-3.5 text-center text-[12.5px] text-muted-foreground">
          <Link to="/connexion" className="font-semibold text-primary">Annuler</Link>
        </div>
      </FormCard>
    </AuthShell>
  );
}
