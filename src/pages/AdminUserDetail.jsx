import { useState } from "react";
import { ChevronLeft, Shield, Mail, Briefcase, Save, AlertCircle, CheckCircle2, User } from "lucide-react";
import { useUserAuth } from "../context/UserAuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { NAVY, GOLD, MUTED, LINE, CREAM, INK } from "../lib/theme.js";
import Button from "../components/ui/Button.jsx";

const ROLE_LABELS = { candidate: "Candidat", admin: "Administrateur", super_admin: "Super Administrateur" };
const ROLE_DESC = {
  candidate: "Accès aux assessments, gestion de son profil",
  admin: "Accès complet à l'administration, gestion des utilisateurs",
  super_admin: "Accès total : gestion admins, permissions, bootstrap super_admin",
};
const STATUS_LABELS = { active: "Actif", inactive: "Inactif", suspended: "Suspendu" };
const STATUS_TONES = { active: "success", inactive: "muted", suspended: "warning" };

export default function AdminUserDetail({
  user,
  onClose,
  onResetPassword,
  onToggleStatus,
  onRoleChange,
  canManageRoles,
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [status, setStatus] = useState(user.status);
  const [roles, setRoles] = useState(user.role_ids || ["candidate"]);
  const [profileData, setProfileData] = useState({
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    phone: user.phone || "",
    location: user.location || "",
    job_title: user.job_title || "",
    linkedin_url: user.linkedin_url || "",
    bio: user.bio || "",
  });

  const handleSaveProfile = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase.from("profiles").update(profileData).eq("id", user.id);
      if (error) throw error;
      setMessage({ type: "success", text: "Profil mis à jour." });
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la sauvegarde." });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = () => onToggleStatus(user);

  const handleRoleToggle = (roleId) => {
    const add = !roles.includes(roleId);
    onRoleChange(user.id, roleId, add);
    setRoles((prev) => add ? [...prev, roleId] : prev.filter((r) => r !== roleId));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <button onClick={onClose} style={{
        display: "flex", alignItems: "center", gap: 5, background: "none", border: "none",
        color: MUTED, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 4, fontFamily: "inherit",
      }}>
        <ChevronLeft size={16} /> Retour à la liste
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600, color: NAVY }}>
                {user.first_name || user.last_name ? `${user.first_name || ""} ${user.last_name || ""}`.trim() : user.email}
              </div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{user.email}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20,
                background: STATUS_TONES[status] === "success" ? "#E3F0E4" : STATUS_TONES[status] === "warning" ? "#FEF3C7" : "#F3F4F6",
                color: STATUS_TONES[status] === "success" ? "#2E6B3C" : STATUS_TONES[status] === "warning" ? "#92400E" : "#6B7280", fontWeight: 600 }}>
                {STATUS_LABELS[status] || status}
              </span>
              {status !== "active" ? (
                <Button variant="outline" size="xs" onClick={handleStatusChange}>Réactiver</Button>
              ) : (
                <Button variant="outline" size="xs" onClick={handleStatusChange}>Désactiver</Button>
              )}
            </div>
          </div>

          <div style={{ marginBottom: 16, padding: "12px", background: CREAM, borderRadius: 8, border: `1px solid ${LINE}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Shield size={16} color={user.role_ids?.includes("admin") || user.role_ids?.includes("super_admin") ? GOLD : MUTED} />
              <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase" }}>Rôle(s)</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {roles.map((r) => (
                <span key={r} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20,
                  background: r === "admin" || r === "super_admin" ? "#EDE9DC" : "#F3F4F6",
                  color: r === "admin" || r === "super_admin" ? "#7A5A15" : "#374151", fontWeight: 600 }}>
                  {ROLE_LABELS[r] || r}
                </span>
              ))}
            </div>
          </div>

          {canManageRoles && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
              <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", marginBottom: 8 }}>Attribuer / retirer des rôles</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {["candidate", "admin", "super_admin"].map((r) => (
                  <label key={r} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={roles.includes(r)}
                      onChange={() => handleRoleToggle(r)}
                      disabled={r === "super_admin" && !roles.includes("super_admin")}
                      style={{ width: 16, height: 16, accentColor: NAVY }}
                    />
                    <span style={{ fontWeight: roles.includes(r) ? 600 : 400 }}>{ROLE_LABELS[r]}</span>
                    <span style={{ fontSize: 11, color: MUTED }}>{ROLE_DESC[r]}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${LINE}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="outline" size="sm" onClick={() => onResetPassword(user.id, user.email)}>
              <Mail size={14} /> Réinitialiser mot de passe
            </Button>
          </div>
        </div>

        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <User size={18} color={NAVY} />
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 16, fontWeight: 600, color: NAVY }}>Informations personnelles</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", marginBottom: 4 }}>Prénom</div>
                <input
                  value={profileData.first_name}
                  onChange={(e) => setProfileData((p) => ({ ...p, first_name: e.target.value }))}
                  placeholder="Prénom"
                  style={{ width: "100%", padding: "10px 12px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit" }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", marginBottom: 4 }}>Nom</div>
                <input
                  value={profileData.last_name}
                  onChange={(e) => setProfileData((p) => ({ ...p, last_name: e.target.value }))}
                  placeholder="Nom"
                  style={{ width: "100%", padding: "10px 12px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit" }}
                />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", marginBottom: 4 }}>Téléphone</div>
              <input
                value={profileData.phone}
                onChange={(e) => setProfileData((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+33 6 00 00 00 00"
                style={{ width: "100%", padding: "10px 12px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit" }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", marginBottom: 4 }}>Localisation</div>
              <input
                value={profileData.location}
                onChange={(e) => setProfileData((p) => ({ ...p, location: e.target.value }))}
                placeholder="Ville, Pays"
                style={{ width: "100%", padding: "10px 12px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit" }}
              />
            </div>
          </div>
        </div>

        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Briefcase size={18} color={NAVY} />
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 16, fontWeight: 600, color: NAVY }}>Informations professionnelles</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", marginBottom: 4 }}>Fonction / Poste</div>
              <input
                value={profileData.job_title}
                onChange={(e) => setProfileData((p) => ({ ...p, job_title: e.target.value }))}
                placeholder="Ex: Directeur formation, Consultant RH..."
                style={{ width: "100%", padding: "10px 12px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit" }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", marginBottom: 4 }}>LinkedIn</div>
              <input
                value={profileData.linkedin_url}
                onChange={(e) => setProfileData((p) => ({ ...p, linkedin_url: e.target.value }))}
                placeholder="https://linkedin.com/in/votreprofil"
                style={{ width: "100%", padding: "10px 12px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit" }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", marginBottom: 4 }}>Bio</div>
              <textarea
                value={profileData.bio}
                onChange={(e) => setProfileData((p) => ({ ...p, bio: e.target.value }))}
                placeholder="Quelques mots sur le parcours..."
                rows={3}
                style={{ width: "100%", padding: "10px 12px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
              />
            </div>
          </div>

          <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={handleSaveProfile} disabled={saving} size="lg">
              <Save size={16} /> {saving ? "Sauvegarde…" : "Enregistrer les modifications"}
            </Button>
          </div>
        </div>
      </div>

      {message && (
        <div style={{
          marginTop: 16, padding: "10px 14px", borderRadius: 8, fontSize: 13,
          background: message.type === "success" ? "#E3F0E4" : "#FAE8E6",
          border: `1px solid ${message.type === "success" ? "#BFE0C4" : "#F5C6C3"}`,
          color: message.type === "success" ? "#2E6B3C" : "#8A2B22",
          display: "flex", alignItems: "center", gap: 8
        }}>
          {message.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}
    </div>
  );
}