import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAdminAuth } from "../context/admin-auth-hooks.js";
import { BATTERIES } from "../data/index.js";
import { loadModeTestCandidate } from "../services/assessments/modeTest.js";
import { accountProgress } from "../lib/scoring.js";
import AppShell from "../components/layout/AppShell.jsx";
import BatterySidebar from "../components/layout/BatterySidebar.jsx";
import PageTitle from "../components/ui/PageTitle.jsx";
import Button from "../components/ui/Button.jsx";
import ResponsesReview from "../components/question/ResponsesReview.jsx";

const EMPTY_RESPONSES = { mcq: {}, b7: {}, b8: {} };

// S9-2 : « Voir les réponses (mode test) » relit les données persistées dans
// Supabase (attempts → responses → questions via loadBatteries) — voir
// src/services/assessments/modeTest.js. Aucune donnée candidat n'est lue
// depuis localStorage pour les comptes plateforme : la relecture fonctionne
// sur un navigateur sans aucune donnée locale du candidat.

export default function ModeTest() {
  const { id } = useParams();
  const decodedId = id ? decodeURIComponent(id) : "";
  const { logout } = useAdminAuth();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [candidate, setCandidate] = useState(null);
  const [active, setActive] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await loadModeTestCandidate(decodedId);
      if (cancelled) return;
      setCandidate(res);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [decodedId]);

  const responses = candidate?.responses || EMPTY_RESPONSES;
  const batteries = candidate?.batteries || [];
  const batteryList = batteries.length > 0 ? batteries : BATTERIES;

  // Progression calculée sur les réponses réellement chargées — fonctionne
  // pour un jeu partiel (ex. 10/197).
  const answeredTotal = useMemo(() => accountProgress(responses), [responses]);

  const handleLogout = () => { logout(); navigate("/login"); };

  const currentBattery =
    batteryList.find((b) => b.id === active) || batteryList[0] || null;

  const goBattery = (bId) => {
    setActive(bId);
  };

  const sidebar = (
    <BatterySidebar
      active={active}
      setActive={goBattery}
      responses={responses}
      userEmail={candidate?.label || ""}
      onLogout={handleLogout}
      onHome={() => goBattery(1)}
    />
  );

  if (!ready) {
    return (
      <AppShell maxWidth={900} sidebar={sidebar}>
        <PageTitle title="Mode test" subtitle="Relecture des réponses d'un candidat (lecture seule)" />
        <div className="rounded-xl border border-border bg-card p-8 text-center text-[13.5px] leading-[1.7] text-muted-foreground">
          Chargement de la relecture…
        </div>
      </AppShell>
    );
  }

  if (candidate?.error) {
    return (
      <AppShell maxWidth={900} sidebar={sidebar}>
        <PageTitle title="Mode test" subtitle="Relecture des réponses d'un candidat (lecture seule)" />
        <div className="rounded-xl border border-border bg-card p-8 text-center text-[13.5px] leading-[1.7] text-muted-foreground">
          {candidate.error}
        </div>
      </AppShell>
    );
  }

  const attempt = candidate?.attempt || null;
  const attemptInfo = attempt
    ? attempt.status === "completed"
      ? "Tentative terminée"
      : attempt.status === "abandoned"
        ? "Tentative abandonnée"
        : "Tentative en cours"
    : "Aucune tentative enregistrée";

  return (
    <AppShell maxWidth={900} sidebar={sidebar}>
      <PageTitle
        title={currentBattery ? `Batterie ${currentBattery.id}` : "Mode test"}
        subtitle={currentBattery ? currentBattery.name : ""}
        right={
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-foreground">
              Mode test
            </span>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
              <ArrowLeft size={14} /> Retour aux résultats
            </Button>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
        <span className="font-bold text-foreground">{candidate?.label || ""}</span>
        <span>·</span>
        <span>{attemptInfo}</span>
        <span>·</span>
        <span>
          {answeredTotal.answered}/{answeredTotal.total} réponses enregistrées
        </span>
        {candidate?.kind === "supabase" && (
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold">
            Source : Supabase
          </span>
        )}
        {candidate?.fallback && (
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold">
            Questions : repli statique
          </span>
        )}
      </div>
      <ResponsesReview
        responses={responses}
        batteryId={active}
        batteries={batteries.length > 0 ? batteries : undefined}
      />
      <div className="mt-2 flex justify-end">
        {active < 8 && (
          <Button onClick={() => goBattery(active + 1)}>
            Batterie suivante <ChevronRight size={15} />
          </Button>
        )}
      </div>
    </AppShell>
  );
}
