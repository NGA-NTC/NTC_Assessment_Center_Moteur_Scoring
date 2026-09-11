import { useState, useEffect } from "react";
import { ArrowLeft, ChevronRight, Menu, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import UserAvatar from "../components/layout/UserAvatar.jsx";
import { BATTERIES } from "../data/index.js";
import { listAccounts, listImported, listHiddenStaticFiles } from "../lib/storage.js";
import { listImportedResults } from "../lib/imported.js";
import { buildCandidates } from "../lib/candidates.js";
import { GOLD, INK, LINE, MUTED } from "../lib/theme.js";
import AppShell from "../components/layout/AppShell.jsx";
import Sidebar from "../components/layout/Sidebar.jsx";
import PageTitle from "../components/ui/PageTitle.jsx";
import Button from "../components/ui/Button.jsx";
import ResponsesReview from "../components/question/ResponsesReview.jsx";

export default function ModeTest() {
  const { id } = useParams();
  const decodedId = id ? decodeURIComponent(id) : "";
  const { logout } = useAdminAuth();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(1);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [accounts, staticImports, hiddenStatic, runtimeImports] = await Promise.all([
        listAccounts(),
        listImportedResults(),
        listHiddenStaticFiles().catch(() => []),
        listImported(),
      ]);
      if (cancelled) return;
      const found = buildCandidates({ accounts, staticImports, runtimeImports, hiddenStatic })
        .find((c) => c.id === decodedId) || null;
      setCandidate(found);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [decodedId]);

  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMobileSidebarOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileSidebarOpen]);

  const handleLogout = () => { logout(); navigate("/login"); };
  const currentBattery = BATTERIES.find((b) => b.id === active);

  const goBattery = (bId) => {
    setActive(bId);
    setMobileSidebarOpen(false);
  };
  const sidebar = candidate && (
    <Sidebar
      active={active}
      setActive={goBattery}
      responses={candidate.responses}
      userEmail={candidate.label}
      onLogout={handleLogout}
      onHome={() => goBattery(1)}
    />
  );

  if (!candidate) {
    return (
      <AppShell maxWidth={900} sidebar={<div className="app-sidebar-desktop">{sidebar}</div>}>
        <div className="app-mobile-topbar" />
        <PageTitle title="Mode test" subtitle="Relecture des réponses d'un candidat (lecture seule)" />
        {ready && (
          <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 30, textAlign: "center", color: MUTED, fontSize: 13.5, lineHeight: 1.7 }}>
            Candidat introuvable ou supprimé.
          </div>
        )}
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth={900} sidebar={<div className="app-sidebar-desktop">{sidebar}</div>}>
      {mobileSidebarOpen && (
        <>
          <button type="button" aria-label="Fermer le menu des batteries" className="app-sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} />
          <aside id="app-mobile-sidebar-drawer" className="app-sidebar-drawer" role="dialog" aria-modal="true" aria-label="Navigation batteries">
            <div className="app-sidebar-drawer__header">
              <button type="button" className="app-sidebar-drawer__close" onClick={() => setMobileSidebarOpen(false)}>
                <X size={18} />
                <span>Fermer</span>
              </button>
            </div>
            {sidebar}
          </aside>
        </>
      )}
      <div className="app-mobile-topbar">
        <button
          type="button"
          className="app-mobile-sidebar-toggle"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Ouvrir le menu des batteries"
          aria-controls="app-mobile-sidebar-drawer"
          aria-expanded={mobileSidebarOpen}
        >
          <Menu size={18} />
          <span>Batteries</span>
        </button>
        <UserAvatar onNavigate={(path) => window.location.href = path} />
      </div>
      <PageTitle
        title={`Batterie ${currentBattery.id}`}
        subtitle={currentBattery.name}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: INK, fontWeight: 600 }}>
              Mode test
            </span>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
              <ArrowLeft size={14} /> Retour aux résultats
            </Button>
          </div>
        }
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 12.5, color: MUTED }}>
        <span style={{ color: GOLD, fontWeight: 700 }}>{candidate.label}</span>
        <span>·</span>
        <span>Relecture des réponses telles qu'affichées durant le test (lecture seule).</span>
      </div>
      <ResponsesReview responses={candidate.responses} batteryId={active} />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        {active < 8 && (
          <Button onClick={() => goBattery(active + 1)}>
            Batterie suivante <ChevronRight size={15} />
          </Button>
        )}
      </div>
    </AppShell>
  );
}