import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Save, Shield, Mail, Link, User, Lock } from "lucide-react";
import { useUserAuth } from "../context/UserAuthContext.jsx";
import { useEffectiveAuthority } from "../hooks/auth/useEffectiveAuthority.js";
import AppShell from "../components/layout/AppShell.jsx";
import AppSidebar from "../components/layout/AppSidebar.jsx";
import PageTitle from "../components/ui/PageTitle.jsx";
import Field from "../components/ui/Field.jsx";
import Button from "../components/ui/Button.jsx";
import Alert from "../components/ui/Alert.jsx";
import Tabs from "../components/ui/Tabs.jsx";
import { LoadingState } from "../components/ui/States.jsx";
import { GOLD, MUTED, LINE, CREAM, INK, radius, type } from "../lib/theme.js";

const SECTIONS = [
  { id: "personal", label: "Informations personnelles", icon: User },
  { id: "professional", label: "Informations professionnelles", icon: Link },
  { id: "account", label: "Compte & Sécurité", icon: Shield },
];

const ROLE_PRIORITY = [
  { id: "super_admin", label: "Super Administrateur" },
  { id: "admin", label: "Administrateur" },
  { id: "candidate", label: "Candidat" },
];

function computeRoleDisplay(roles) {
  for (const { id, label } of ROLE_PRIORITY) {
    if (roles.some((r) => r.id === id)) return label;
  }
  return roles.length > 0 ? roles[0].name : "Aucun rôle";
}

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  phone: "",
  location: "",
  job_title: "",
  linkedin_url: "",
  bio: "",
};

function InfoBox({ icon: Icon, iconColor, label, children }) {
  return (
    <div style={{ background: CREAM, border: `1px solid ${LINE}`, borderRadius: radius.md, padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <Icon size={18} color={iconColor ?? MUTED} style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: type.fontSize.xs, color: MUTED, textTransform: "uppercase", fontWeight: type.fontWeight.semibold }}>{label}</div>
          <div style={{ fontWeight: type.fontWeight.semibold, fontSize: type.fontSize.base }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, profile, roles, updateProfile, loading: authLoading } = useUserAuth();
  const { can } = useEffectiveAuthority();
  const [activeSection, setActiveSection] = useState("personal");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    const fillForm = async () => {
      if (!profile) return;
      await Promise.resolve();
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        phone: profile.phone || "",
        location: profile.location || "",
        job_title: profile.job_title || "",
        linkedin_url: profile.linkedin_url || "",
        bio: profile.bio || "",
      });
    };
    fillForm();
  }, [profile]);

  if (authLoading) {
    return (
      <AppShell maxWidth={720}>
        <LoadingState minHeight="60vh" />
      </AppShell>
    );
  }

  if (!user) {
    return <Navigate to="/connexion" replace />;
  }

  const canViewProfile = can("profile.view");
  const canEditProfile = can("profile.edit");
  const roleDisplay = computeRoleDisplay(roles ?? []);
  const isPrivileged = (roles ?? []).some((r) => r.id === "admin" || r.id === "super_admin");
  const roleColor = isPrivileged ? GOLD : INK;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setMessage(null);
  };

  const handleSave = async () => {
    if (!canEditProfile || !profile?.id) return;
    setSaving(true);
    setMessage(null);
    const res = await updateProfile(formData);
    setSaving(false);
    if (res.ok) {
      setMessage({ type: "success", text: "Profil mis à jour avec succès." });
    } else {
      setMessage({ type: "error", text: res.error });
    }
  };

  const goTo = (path) => { window.location.href = path; };

  const renderPersonal = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Prénom" value={formData.first_name} onChange={(e) => handleChange("first_name", e.target.value)} placeholder="Prénom" autoComplete="given-name" disabled={!canEditProfile} />
        <Field label="Nom" value={formData.last_name} onChange={(e) => handleChange("last_name", e.target.value)} placeholder="Nom" autoComplete="family-name" disabled={!canEditProfile} />
      </div>
      <Field label="Téléphone" value={formData.phone} onChange={(e) => handleChange("phone", e.target.value)} placeholder="+33 6 00 00 00 00" autoComplete="tel" disabled={!canEditProfile} />
      <Field label="Localisation" value={formData.location} onChange={(e) => handleChange("location", e.target.value)} placeholder="Ville, Pays" autoComplete="address-level2" disabled={!canEditProfile} />
    </div>
  );

  const renderProfessional = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Field label="Fonction / Poste" value={formData.job_title} onChange={(e) => handleChange("job_title", e.target.value)} placeholder="Ex: Directeur formation, Consultant RH..." autoComplete="organization-title" disabled={!canEditProfile} />
      <Field label="LinkedIn" value={formData.linkedin_url} onChange={(e) => handleChange("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/votreprofil" autoComplete="url" disabled={!canEditProfile} />
      <Field label="Bio" value={formData.bio} onChange={(e) => handleChange("bio", e.target.value)} placeholder="Quelques mots sur votre parcours..." multiline rows={4} disabled={!canEditProfile} />
    </div>
  );

  const renderAccount = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <InfoBox icon={Mail} label="Email (Supabase Auth)">
        {user?.email}
        <div style={{ fontSize: type.fontSize.sm, color: MUTED, fontWeight: type.fontWeight.regular, marginTop: 4, lineHeight: 1.6 }}>
          L'email est géré par Supabase Auth. Pour le modifier, utilisez la fonctionnalité de changement d'email dans les paramètres de sécurité Supabase.
        </div>
      </InfoBox>
      <InfoBox icon={Shield} iconColor={roleColor} label="Rôle">
        <span style={{ color: roleColor }}>{roleDisplay}</span>
        <div style={{ fontSize: type.fontSize.sm, color: MUTED, fontWeight: type.fontWeight.regular, marginTop: 4 }}>
          {isPrivileged ? "Vous avez accès à l'espace administrateur." : "Rôle attribué automatiquement à la création du compte."}
        </div>
      </InfoBox>
      <div style={{ marginTop: 4 }}>
        <Button variant="outlineDark" size="sm" onClick={() => goTo("/modifier-mot-de-passe")} style={{ maxWidth: 280 }}>
          <Lock size={16} /> Modifier le mot de passe
        </Button>
      </div>
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {
      case "personal": return renderPersonal();
      case "professional": return renderProfessional();
      case "account": return renderAccount();
      default: return null;
    }
  };

  return (
    <AppShell maxWidth={720} sidebar={<AppSidebar />}>
      <PageTitle title="Mon compte" subtitle={roleDisplay} />
      {message && (
        <Alert type={message.type} onDismiss={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}
      {!canViewProfile ? (
        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: radius.lg, padding: "40px", textAlign: "center", color: MUTED }}>
          Vous n'avez pas la permission de consulter votre profil (profile.view requis).
        </div>
      ) : (
        <>
          <Tabs
            items={SECTIONS}
            active={activeSection}
            onChange={setActiveSection}
            variant="pills"
            style={{ marginBottom: 20, background: "transparent" }}
          />
          <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: radius.lg, padding: "24px", boxShadow: "0 8px 30px rgba(27,42,74,0.08)" }}>
            {renderSection()}
            {canEditProfile && (
              <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
                <Button onClick={handleSave} disabled={saving} size="lg" loading={saving}>
                  <Save size={16} /> {saving ? "Sauvegarde…" : "Enregistrer les modifications"}
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}