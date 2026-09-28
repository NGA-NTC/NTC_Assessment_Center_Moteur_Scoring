import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Mail, UserPlus } from "lucide-react";
import { useUserAuth } from "../context/user-auth-hooks.js";
import AuthShell from "../components/layout/AuthShell.jsx";
import BrandHeader from "../components/ui/BrandHeader.jsx";
import FormCard from "../components/ui/FormCard.jsx";
import Field from "../components/ui/Field.jsx";
import PasswordField from "../components/ui/PasswordField.jsx";
import Button from "../components/ui/Button.jsx";

export default function Register() {
  const { user, register } = useUserAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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
        <Field label="Email" icon={<Mail size={16} color="var(--muted-foreground)" />} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" autoFocus autoComplete="email" />
        <PasswordField label="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Au moins 4 caractères" autoComplete="new-password" />
        <PasswordField label="Confirmer le mot de passe" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirmez le mot de passe" autoComplete="new-password" />
        {error && <div className="mb-3 text-[12.5px] text-warning">{error}</div>}
        {success && <div className="mb-3 rounded-lg border border-success-border bg-success-soft p-2.5 text-[12.5px] text-success">{success}</div>}
        <Button full size="lg" type="submit" disabled={loading}>
          <UserPlus size={16} /> {loading ? "Création…" : "Créer mon compte"}
        </Button>
        <div className="mt-3.5 text-center text-[12.5px] text-muted-foreground">
          Déjà inscrit ? <Link to="/connexion" className="font-semibold text-primary">Se connecter</Link>
        </div>
      </FormCard>
    </AuthShell>
  );
}
