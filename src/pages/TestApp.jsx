import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUserAuth } from "../context/UserAuthContext.jsx";
import { BATTERIES } from "../data/index.js";
import { emptyResponses } from "../lib/scoring.js";
import { loadAccountResponses, saveAccountResponses } from "../lib/storage.js";
import AppShell from "../components/layout/AppShell.jsx";
import Sidebar from "../components/layout/BatterySidebar.jsx";
import SuperAdminSidebar from "../components/layout/SuperAdminSidebar.jsx";
import AdminSidebar from "../components/layout/AdminSidebar.jsx";
import PageTitle from "../components/ui/PageTitle.jsx";
import Button from "../components/ui/Button.jsx";
import McqBattery from "../components/question/McqBattery.jsx";
import RubricBattery from "../components/question/RubricBattery.jsx";
import CoherenceBattery from "../components/question/CoherenceBattery.jsx";

export default function TestApp() {
  const { user, logout, loading, hasRole } = useUserAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState(1);
  const [responses, setResponses] = useState(emptyResponses());
  const [hydrated, setHydrated] = useState(false);

  const isSuperAdmin = hasRole("super_admin");
  const isAdmin = hasRole("admin");

  const returnPath = useMemo(() => {
    if (isSuperAdmin) return "/super-admin";
    if (isAdmin) return "/admin";
    return null;
  }, [isSuperAdmin, isAdmin]);

  const goReturn = () => {
    if (returnPath) navigate(returnPath);
  };

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

  const handleLogout = useCallback(() => { logout(); navigate("/connexion"); }, [logout, navigate]);
  const currentBattery = BATTERIES.find((b) => b.id === active);

  const sidebar = useMemo(() => {
    if (isSuperAdmin) return <SuperAdminSidebar />;
    if (isAdmin) {
      return (
        <AdminSidebar
          onNavigate={(path) => { window.location.href = path; }}
          onHome={() => setActive(1)}
        />
      );
    }
    return (
      <Sidebar
        active={active}
        setActive={setActive}
        responses={responses}
        userEmail={user?.email}
        onLogout={handleLogout}
        onHome={() => setActive(1)}
      />
    );
  }, [isSuperAdmin, isAdmin, active, responses, user, handleLogout]);

  if (loading) {
    return (
      <AppShell maxWidth={900}>
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
          Chargement…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth={900} sidebar={sidebar}>
      <PageTitle
        title={`Batterie ${currentBattery.id}`}
        subtitle={currentBattery.name}
        right={returnPath && (
          <Button variant="outline" size="sm" onClick={goReturn}>
            <ArrowLeft size={14} /> Retour à l'espace {isSuperAdmin ? "Super Admin" : "Admin"}
          </Button>
        )}
      />
      {currentBattery.type === "correct" || currentBattery.type === "weighted" ? (
        <McqBattery battery={currentBattery} responses={responses} setResponses={setResponses} />
      ) : currentBattery.type === "rubric" ? (
        <RubricBattery battery={currentBattery} responses={responses} setResponses={setResponses} />
      ) : (
        <CoherenceBattery battery={currentBattery} responses={responses} setResponses={setResponses} />
      )}
      <div className="mt-2 flex justify-end">
        {active < 8 && (
          <Button onClick={() => setActive(active + 1)}>
            Batterie suivante <ChevronRight size={15} />
          </Button>
        )}
      </div>
    </AppShell>
  );
}