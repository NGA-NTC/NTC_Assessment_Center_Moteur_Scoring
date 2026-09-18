import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Loader2, Shield, Save, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import PageTitle from "../components/ui/PageTitle.jsx";
import Button from "../components/ui/Button.jsx";
import { NAVY, MUTED, LINE, CREAM, INK, GOLD } from "../lib/theme.js";
import Card from "../components/ui/Card.jsx";

export default function SuperAdminAccess() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const initialSelectionDone = useRef(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes, rpRes] = await Promise.all([
        supabase.from("roles").select("id, name").order("id"),
        supabase.from("permissions").select("id, name, description, category").order("category, name"),
        supabase.from("role_permissions").select("role_id, permission_id"),
      ]);

      if (rolesRes.error) throw rolesRes.error;
      if (permsRes.error) throw permsRes.error;
      if (rpRes.error) throw rpRes.error;

      setRoles(rolesRes.data || []);
      setPermissions(permsRes.data || []);

      const rpMap = {};
      (rpRes.data || []).forEach(rp => {
        if (!rpMap[rp.role_id]) rpMap[rp.role_id] = new Set();
        rpMap[rp.role_id].add(rp.permission_id);
      });
      setRolePermissions(rpMap);

      // Only set initial selectedRoleId if none selected yet
      if (!initialSelectionDone.current && rolesRes.data && rolesRes.data.length > 0 && !selectedRoleId) {
        initialSelectionDone.current = true;
        setSelectedRoleId(rolesRes.data[0].id);
      }
    } catch (e) {
      console.error("Erreur chargement accès:", e);
      setMessage({ type: "error", text: "Impossible de charger les données d'accès." });
    } finally {
      setLoading(false);
    }
  }, [selectedRoleId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePermissionToggle = (roleId, permissionId) => {
    setRolePermissions(prev => {
      const newMap = { ...prev };
      if (!newMap[roleId]) newMap[roleId] = new Set();
      const perms = new Set(newMap[roleId]);
      if (perms.has(permissionId)) {
        perms.delete(permissionId);
      } else {
        perms.add(permissionId);
      }
      newMap[roleId] = perms;
      return newMap;
    });
  };

  const handleSave = async () => {
    if (!selectedRoleId) return;
    setSaving(true);
    try {
      const currentPerms = rolePermissions[selectedRoleId] || new Set();
      const currentArray = Array.from(currentPerms);
      
      const { data: existing } = await supabase.from("role_permissions").select("permission_id").eq("role_id", selectedRoleId);
      const existingIds = new Set((existing || []).map(r => r.permission_id));
      
      const toAdd = currentArray.filter(id => !existingIds.has(id));
      const toRemove = Array.from(existingIds).filter(id => !currentPerms.has(id));

      // Use RPCs for all mutations instead of direct table access
      // Process removals first
      for (const permId of toRemove) {
        const { error } = await supabase.rpc('revoke_role_permission', {
          p_target_role_id: selectedRoleId,
          p_permission_id: permId,
          p_capabilities: ['USE', 'MANAGE', 'GRANT', 'DELEGATE'],
          p_scope_type: 'global',
          p_scope_value: null
        });
        if (error) throw new Error(`Erreur retrait ${permId}: ${error.message}`);
      }

      // Process additions
      for (const permId of toAdd) {
        const { error } = await supabase.rpc('grant_role_permission', {
          p_target_role_id: selectedRoleId,
          p_permission_id: permId,
          p_capabilities: { use: true, manage: false, grant: false, delegate: false },
          p_scope_type: 'global',
          p_scope_value: null
        });
        if (error) throw new Error(`Erreur attribution ${permId}: ${error.message}`);
      }

      // Refresh from database to ensure consistency
      const { data: refreshed } = await supabase.from("role_permissions").select("permission_id").eq("role_id", selectedRoleId);
      const refreshedIds = new Set((refreshed || []).map(r => r.permission_id));
      setRolePermissions(prev => {
        const newMap = { ...prev };
        newMap[selectedRoleId] = refreshedIds;
        return newMap;
      });

      setMessage({ type: "success", text: "Accès mis à jour." });
    } catch (e) {
      console.error("Erreur sauvegarde accès:", e);
      setMessage({ type: "error", text: e.message || "Erreur lors de la sauvegarde." });
    } finally {
      setSaving(false);
    }
  };

  const permissionsByCategory = useMemo(() => {
    const grouped = {};
    permissions.forEach(p => {
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    });
    return grouped;
  }, [permissions]);

  const selectedRole = roles.find(r => r.id === selectedRoleId);
  const selectedRolePerms = rolePermissions[selectedRoleId] || new Set();

  return (
    <div>
      <PageTitle
        title="Accès"
        subtitle={loading ? "Chargement…" : selectedRole ? `Gestion des permissions pour « ${selectedRole.name} »` : "Sélectionnez un rôle"}
        action={
          selectedRole && (
            <Button onClick={handleSave} disabled={saving}>
              <Save size={16} /> {saving ? "Sauvegarde…" : "Sauvegarder"}
            </Button>
          )
        }
      />

      {message && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 8, background: message.type === "success" ? "#E3F0E4" : "#FAE8E6", color: message.type === "success" ? "#2E6B3C" : "#8A2B22", fontSize: 13 }}>
          {message.text}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 24 }}>
        <Card style={{ padding: 0, overflow: "hidden", height: "fit-content", position: "sticky", top: "100px" }}>
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${LINE}`, background: CREAM, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: INK }}>Rôles</div>
            <Shield size={20} color={GOLD} />
          </div>
          <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: "24px", textAlign: "center", color: MUTED }}>
                <Loader2 size={24} className="spin" style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px" }} /> Chargement…
              </div>
            ) : roles.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: MUTED }}>Aucun rôle</div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {roles.map(role => (
                  <li key={role.id}>
                    <button
                      onClick={() => setSelectedRoleId(role.id)}
                      style={{
                        width: "100%", padding: "14px 20px", textAlign: "left", border: "none",
                        cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: selectedRoleId === role.id ? 600 : 500,
                        color: selectedRoleId === role.id ? NAVY : INK, borderLeft: selectedRoleId === role.id ? `3px solid ${GOLD}` : "3px solid transparent",
                        background: selectedRoleId === role.id ? "#F5F5F5" : "transparent", transition: "all .15s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Shield size={18} color={selectedRoleId === role.id ? GOLD : MUTED} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{role.name}</span>
                      </div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 2, fontFamily: "monospace" }}>{role.id}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <div>
          {loading ? (
            <Card style={{ padding: "48px", textAlign: "center", color: MUTED }}>
              <Loader2 size={24} className="spin" style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px" }} /> Chargement des permissions…
            </Card>
          ) : !selectedRole ? (
            <Card style={{ padding: "48px", textAlign: "center", color: MUTED }}>
              <Shield size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p style={{ fontSize: 16, margin: 0 }}>Sélectionnez un rôle à gauche pour gérer ses accès</p>
            </Card>
          ) : (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: `1px solid ${LINE}`, background: CREAM }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: INK }}>Permissions pour <span style={{ color: NAVY }}>{selectedRole.name}</span></div>
                <div style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>Cochez les permissions à accorder. Les changements ne sont appliqués qu'après sauvegarde.</div>
              </div>
              <div style={{ padding: "20px 24px", maxHeight: "70vh", overflowY: "auto" }}>
                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <div key={category} style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${LINE}` }}>
                      {category}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 8 }}>
                      {perms.map(perm => {
                        const hasPerm = selectedRolePerms.has(perm.id);
                        return (
                          <label key={perm.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: `1px solid ${hasPerm ? GOLD : LINE}`, borderRadius: 8, background: hasPerm ? "#FEFBF3" : "#fff", cursor: "pointer", transition: "all .15s" }}>
                            <input
                              type="checkbox"
                              checked={hasPerm}
                              onChange={() => handlePermissionToggle(selectedRoleId, perm.id)}
                              style={{ width: 18, height: 18, accentColor: GOLD, flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{perm.name}</div>
                              {perm.description && <div style={{ fontSize: 11, color: MUTED, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{perm.description}</div>}
                            </div>
                            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#F0F0F0", color: MUTED, fontFamily: "monospace" }}>{perm.id}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {permissions.length === 0 && (
                  <div style={{ textAlign: "center", color: MUTED, padding: "48px" }}>
                    <AlertCircle size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
                    <p>Aucune permission définie dans le système.</p>
                  </div>
                )}
              </div>
              <div style={{ padding: "16px 24px", borderTop: `1px solid ${LINE}`, background: CREAM, display: "flex", justifyContent: "flex-end" }}>
                <Button onClick={handleSave} disabled={saving}>
                  <Save size={16} /> {saving ? "Sauvegarde…" : "Sauvegarder les modifications"}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}