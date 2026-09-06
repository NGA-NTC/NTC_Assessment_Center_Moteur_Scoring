import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUserAuth } from "../context/UserAuthContext.jsx";
import { BATTERIES } from "../data/index.js";
import { emptyResponses } from "../lib/scoring.js";
import { loadAccountResponses, saveAccountResponses } from "../lib/storage.js";
import AppShell from "../components/layout/AppShell.jsx";
import Sidebar from "../components/layout/Sidebar.jsx";
import PageTitle from "../components/ui/PageTitle.jsx";
import Button from "../components/ui/Button.jsx";
import McqBattery from "../components/question/McqBattery.jsx";
import RubricBattery from "../components/question/RubricBattery.jsx";
import CoherenceBattery from "../components/question/CoherenceBattery.jsx";

export default function TestApp() {
  const { currentUser, logout } = useUserAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState(1);
  const [responses, setResponses] = useState(emptyResponses());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    loadAccountResponses(currentUser.email).then((saved) => {
      if (cancelled) return;
      if (saved) setResponses(saved);
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !hydrated) return;
    const t = setTimeout(() => { saveAccountResponses(currentUser.email, responses); }, 400);
    return () => clearTimeout(t);
  }, [responses, currentUser, hydrated]);

  const handleLogout = () => { logout(); navigate("/connexion"); };
  const currentBattery = BATTERIES.find((b) => b.id === active);

  return (
    <AppShell maxWidth={900} sidebar={<Sidebar active={active} setActive={setActive} responses={responses} userEmail={currentUser?.email} onLogout={handleLogout} />}>
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