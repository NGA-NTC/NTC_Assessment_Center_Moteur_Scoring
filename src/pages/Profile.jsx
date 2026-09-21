import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Save, CheckCircle2, AlertCircle, Shield, Mail, Link, Lock, User } from "lucide-react";
import { useUserAuth } from "../context/UserAuthContext.jsx";
import { useEffectiveAuthority } from "../hooks/auth/useEffectiveAuthority.js";
import AppShell from "../components/layout/AppShell.jsx";
import AppSidebar from "../components/layout/AppSidebar.jsx";
import PageTitle from "../components/ui/PageTitle.jsx";
import Field from "../components/ui/Field.jsx";
import Button from "../components/ui/Button.jsx";
import { NAVY, GOLD, MUTED, LINE, CREAM, INK } from "../lib/theme.js";

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <div style={{ fontSize: 14, color: MUTED }}>Chargement…</div>
        </div>
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
      <div style={{ background: CREAM, border: `1px solid ${LINE}`, borderRadius: 10, padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Mail size={18} color={MUTED} />
          <div>
            <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase" }}>Email (Supabase Auth)</div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{user?.email}</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: MUTED }}>
          L'email est géré par Supabase Auth. Pour le modifier, utilisez la fonctionnalité de changement d'email dans les paramètres de sécurité Supabase.
        </div>
      </div>
      <div style={{ background: CREAM, border: `1px solid ${LINE}`, borderRadius: 10, padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Shield size={18} color={roleColor} />
          <div>
            <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase" }}>Rôle</div>
            <div style={{ fontWeight: 600, fontSize: 13, color: roleColor }}>
              {roleDisplay}
            </div>
          </div>
        </div>
        {isPrivileged ? (
          <div style={{ fontSize: 12, color: MUTED }}>Vous avez accès à l'espace administrateur.</div>
        ) : (
          <div style={{ fontSize: 12, color: MUTED }}>Rôle attribué automatiquement à la création du compte.</div>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={() => goTo("/modifier-mot-de-passe")} style={{ maxWidth: 280 }}>
        <Lock size={16} /> Modifier le mot de passe
      </Button>
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
        <div style={{
          marginBottom: 20, padding: "12px 16px", borderRadius: 8, fontSize: 13,
          background: message.type === "success" ? "#E3F0E4" : "#FAE8E6",
          border: `1px solid ${message.type === "success" ? "#BFE0C4" : "#F5C6C3"}`,
          color: message.type === "success" ? "#2E6B3C" : "#8A2B22",
          display: "flex", alignItems: "center", gap: 8
        }}>
          {message.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}
      {!canViewProfile ? (
        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "40px", textAlign: "center", color: MUTED }}>
          Vous n'avez pas la permission de consulter votre profil (profile.view requis).
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: `1px solid ${LINE}`, paddingBottom: 12 }}>
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "10px 16px",
                background: activeSection === s.id ? NAVY : "transparent",
                color: activeSection === s.id ? "#fff" : MUTED,
                border: "none", borderRadius: 8, cursor: "pointer",
                fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, transition: "all .15s",
              }}>
                <s.icon size={14} /> {s.label}
              </button>
            ))}
          </div>
          <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "24px" }}>
            {renderSection()}
            {canEditProfile && (
              <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
                <Button onClick={handleSave} disabled={saving} size="lg">
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