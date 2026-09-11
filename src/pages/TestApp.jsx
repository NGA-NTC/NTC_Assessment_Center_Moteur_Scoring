import { useState, useEffect } from "react";
import { ChevronRight, Menu, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUserAuth } from "../context/UserAuthContext.jsx";
import { BATTERIES } from "../data/index.js";
import { emptyResponses } from "../lib/scoring.js";
import { loadAccountResponses, saveAccountResponses } from "../lib/storage.js";
import AppShell from "../components/layout/AppShell.jsx";
import Sidebar from "../components/layout/Sidebar.jsx";
import PageTitle from "../components/ui/PageTitle.jsx";
import Button from "../components/ui/Button.jsx";
import UserAvatar from "../components/layout/UserAvatar.jsx";
import McqBattery from "../components/question/McqBattery.jsx";
import RubricBattery from "../components/question/RubricBattery.jsx";
import CoherenceBattery from "../components/question/CoherenceBattery.jsx";

export default function TestApp() {
  const { user, logout, loading } = useUserAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState(1);
  const [responses, setResponses] = useState(emptyResponses());
  const [hydrated, setHydrated] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadAccountResponses(user.email).then((saved) => {
      if (cancelled) return;
      if (saved) setResponses(saved);
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user || !hydrated) return;
    const t = setTimeout(() => { saveAccountResponses(user.email, responses); }, 400);
    return () => clearTimeout(t);
  }, [responses, user, hydrated]);

  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMobileSidebarOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileSidebarOpen]);

  const handleLogout = () => { logout(); navigate("/connexion"); };
  const currentBattery = BATTERIES.find((b) => b.id === active);

  const goBattery = (id) => {
    setActive(id);
    setMobileSidebarOpen(false);
  };
  const sidebar = (
    <Sidebar
      active={active}
      setActive={setActive}
      responses={responses}
      userEmail={user?.email}
      onLogout={handleLogout}
      onHome={() => goBattery(1)}
    />
  );

  if (loading) {
    return (
      <AppShell maxWidth={900} sidebar={<div className="app-sidebar-desktop">{sidebar}</div>}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <div style={{ fontSize: 14, color: "#8A8578" }}>Chargement…</div>
        </div>
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
            <Sidebar
              active={active}
              setActive={goBattery}
              responses={responses}
              userEmail={user?.email}
              onLogout={handleLogout}
              onHome={() => goBattery(1)}
            />
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
      <PageTitle title={`Batterie ${currentBattery.id}`} subtitle={currentBattery.name} />
      {currentBattery.type === "correct" || currentBattery.type === "weighted" ? (
        <McqBattery battery={currentBattery} responses={responses} setResponses={setResponses} />
      ) : currentBattery.type === "rubric" ? (
        <RubricBattery battery={currentBattery} responses={responses} setResponses={setResponses} />
      ) : (
        <CoherenceBattery battery={currentBattery} responses={responses} setResponses={setResponses} />
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        {active < 8 && (
          <Button onClick={() => setActive(active + 1)}>
            Batterie suivante <ChevronRight size={15} />
          </Button>
        )}
      </div>
    </AppShell>
  );
}