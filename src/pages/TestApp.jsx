import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useUserAuth } from "../context/user-auth-hooks.js";
import { loadBatteries } from "../services/assessments/questions.js";
import { emptyResponses, accountProgress } from "../lib/scoring.js";
import { loadAccountResponses, listImported } from "../lib/storage.js";
import { getOrCreateAttempt, updateAttemptProgress } from "../services/assessments/attempts.js";
import { listResponses, saveResponses } from "../services/assessments/responses.js";
import AppShell from "../components/layout/AppShell.jsx";
import Sidebar from "../components/layout/BatterySidebar.jsx";
import SuperAdminSidebar from "../components/layout/SuperAdminSidebar.jsx";
import AdminSidebar from "../components/layout/AdminSidebar.jsx";
import PageTitle from "../components/ui/PageTitle.jsx";
import Button from "../components/ui/Button.jsx";
import { LoadingState } from "../components/ui/States.jsx";
import McqBattery from "../components/question/McqBattery.jsx";
import RubricBattery from "../components/question/RubricBattery.jsx";
import CoherenceBattery from "../components/question/CoherenceBattery.jsx";

const BATTERY_PREFIX = "BATTERY";
const BACKFILL_FLAG = "ntc_p3s8_backfilled";
const EXPECTED_BATTERY_COUNT = 8; // structure du questionnaire (inchangée en S9)

const batteryQuestionId = (id) => `${BATTERY_PREFIX}${id}`;

function batteryFromQuestionId(qid) {
  if (!qid || !qid.startsWith(BATTERY_PREFIX)) return NaN;
  const n = parseInt(qid.slice(BATTERY_PREFIX.length), 10);
  return Number.isInteger(n) && n >= 1 && n <= EXPECTED_BATTERY_COUNT ? n : NaN;
}

function isComplete(responses) {
  const p = accountProgress(responses);
  return p.total > 0 && p.answered === p.total;
}

function sameShape(a, b) {
  const safe = (r) => r || {};
  const am = safe(a).mcq || {}, bm = safe(b).mcq || {};
  const a7 = safe(a).b7 || {}, b7 = safe(b).b7 || {};
  const a8 = safe(a).b8 || {}, b8 = safe(b).b8 || {};
  const eqObj = (x, y) => {
    const kx = Object.keys(x), ky = Object.keys(y);
    if (kx.length !== ky.length) return false;
    return kx.every((k) => {
      const vx = x[k], vy = y[k];
      if (vx && vy && typeof vx === "object" && typeof vy === "object") return sameShape(vx, vy);
      return vx === vy;
    });
  };
  return eqObj(am, bm) && eqObj(a7, b7) && eqObj(a8, b8);
}

/** Fusionne l'ancien cache local dans la forme Supabase (le distant a priorité). */
function mergeShapes(remote, legacy) {
  const src = legacy && typeof legacy === "object" ? legacy : {};
  let added = false;
  const out = { mcq: { ...(remote.mcq || {}) }, b7: {}, b8: {} };
  Object.entries(src.mcq || {}).forEach(([k, v]) => {
    if (out.mcq[k] === undefined && v != null) { out.mcq[k] = v; added = true; }
  });
  Object.entries(src.b7 || {}).forEach(([caseId, dims]) => {
    if (!dims || typeof dims !== "object") return;
    Object.entries(dims).forEach(([k, v]) => {
      const remoteVal = (remote.b7 || {})[caseId]?.[k];
      if (remoteVal === undefined && v != null) {
        out.b7[caseId] = out.b7[caseId] || {};
        out.b7[caseId][k] = v;
        added = true;
      }
    });
  });
  Object.entries(src.b8 || {}).forEach(([itemId, data]) => {
    if (!data || typeof data !== "object") return;
    Object.entries(data).forEach(([k, v]) => {
      const remoteVal = (remote.b8 || {})[itemId]?.[k];
      if (remoteVal === undefined && v != null) {
        out.b8[itemId] = out.b8[itemId] || {};
        out.b8[itemId][k] = v;
        added = true;
      }
    });
  });
  return added ? out : remote;
}

export default function TestApp() {
  const { user, logout, loading, hasRole } = useUserAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState(1);
  const [responses, setResponses] = useState(emptyResponses());
  const [hydrated, setHydrated] = useState(false);
  const [batteries, setBatteries] = useState(null); // S9-2 : contenu Supabase (fallback statique garanti)
  const [saveState, setSaveState] = useState("idle"); // idle | saving | error
  const [saveTick, setSaveTick] = useState(0);

  const attemptRef = useRef(null);
  const serverShapeRef = useRef({ mcq: {}, b7: {}, b8: {} });
  const completedRef = useRef(false);
  const errorToastShownRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const pendingRef = useRef(false);

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

  // ---- S9-2 : contenu des questions (Supabase, fallback statique) --------
  useEffect(() => {
    let cancelled = false;
    loadBatteries().then((res) => {
      if (!cancelled) setBatteries(res.batteries);
    });
    return () => { cancelled = true; };
  }, []);

  // ---- Hydratation : attempt → réponses → position (reprise réelle) -------
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const attempt = await getOrCreateAttempt(user.id);
        if (cancelled) return;
        attemptRef.current = attempt;
        const remote = await listResponses(attempt.id);

        // Backfill unique depuis l'ancien cache local / import lié — jamais
        // supprimé brutalement : le drapeau ne pose que si l'upload réussit.
        try {
          const alreadyBackfilled = localStorage.getItem(BACKFILL_FLAG) === "1";
          if (!alreadyBackfilled) {
            const legacy = await loadAccountResponses(user.email);
            const imports = await listImported();
            const linkedImport = imports.find((im) => im.accountEmail === user.email);
            const legacyShape = legacy || linkedImport?.responses || null;
            if (legacyShape) {
              const merged = mergeShapes(remote, legacyShape);
              if (merged !== remote) {
                const res = await saveResponses(attempt.id, merged, {
                  replace: true,
                  currentQuestionId: attempt.currentQuestionId,
                });
                if (!res.ok) throw res.error;
              }
            }
            localStorage.setItem(BACKFILL_FLAG, "1");
          }
        } catch (e) {
          console.warn("Backfill local ignoré (retragé au prochain passage) :", e);
        }

        if (cancelled) return;
        serverShapeRef.current = remote;
        completedRef.current = attempt.status === "completed";
        setResponses(remote);
        const pos = batteryFromQuestionId(attempt.currentQuestionId);
        if (!Number.isNaN(pos)) setActive(pos);
        setHydrated(true);
      } catch (e) {
        console.error("Chargement de la tentative impossible :", e);
        if (!cancelled) {
          toast.error(
            "Sauvegarde en ligne indisponible (" + (e?.message || "erreur") +
            ") — le test reste utilisable mais les réponses ne seront pas persistées."
          );
          setHydrated(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // ---- Sauvegarde de position (reprise) -----------------------------------
  const goToBattery = useCallback((id) => {
    setActive(id);
    const attempt = attemptRef.current;
    if (attempt) {
      updateAttemptProgress(attempt.id, { currentQuestionId: batteryQuestionId(id) })
        .catch((e) => console.warn("Position non sauvegardée :", e));
    }
  }, []);

  // ---- Autosave Supabase (upsert incrémental, UI jamais bloquée) ----------
  useEffect(() => {
    if (!user || !hydrated) return;
    const attempt = attemptRef.current;
    if (!attempt) return;
    if (sameShape(serverShapeRef.current, responses)) return;

    const run = async () => {
      if (saveInFlightRef.current) { pendingRef.current = true; return; }
      saveInFlightRef.current = true;
      setSaveState("saving");
      const res = await saveResponses(attempt.id, responses, {
        previous: serverShapeRef.current,
        currentQuestionId: batteryQuestionId(active),
        markCompleted: !completedRef.current && isComplete(responses),
      });
      saveInFlightRef.current = false;
      if (res.ok) {
        serverShapeRef.current = responses;
        if (isComplete(responses)) completedRef.current = true;
        setSaveState("idle");
        if (pendingRef.current) {
          pendingRef.current = false;
          setSaveTick((t) => t + 1); // rejoue la dernière modification en attente
        }
      } else {
        console.error("Échec de sauvegarde Supabase :", res.error);
        setSaveState("error");
        if (!errorToastShownRef.current) {
          toast.error("La sauvegarde en ligne a échoué — vos réponses restent à l'écran et seront renvoyées à la prochaine réponse ou via « Réessayer ».");
          errorToastShownRef.current = true;
        }
      }
    };
    const t = setTimeout(run, 400);
    return () => clearTimeout(t);
  }, [responses, active, user, hydrated, saveTick]);

  const handleLogout = useCallback(() => { logout(); navigate("/connexion"); }, [logout, navigate]);
  const batteryList = batteries || []; // rendu uniquement une fois le contenu chargé
  const currentBattery = batteryList.find((b) => b.id === active);

  const sidebar = useMemo(() => {
    if (isSuperAdmin) return <SuperAdminSidebar />;
    if (isAdmin) {
      return (
        <AdminSidebar
          onNavigate={(path) => { window.location.href = path; }}
          onHome={() => goToBattery(1)}
        />
      );
    }
    return (
      <Sidebar
        active={active}
        setActive={goToBattery}
        responses={responses}
        userEmail={user?.email}
        onLogout={handleLogout}
        onHome={() => goToBattery(1)}
      />
    );
  }, [isSuperAdmin, isAdmin, active, responses, user, handleLogout, goToBattery]);

  if (loading || !batteries) {
    return (
      <AppShell maxWidth={900}>
        <LoadingState minHeight={420} label="Chargement de votre espace de test…" />
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
      <div className="flex min-h-[18px] items-center gap-2 text-[11.5px]" role="status" aria-live="polite">
        {saveState === "saving" && <span className="text-muted-foreground">Sauvegarde en cours…</span>}
        {saveState === "error" && (
          <>
            <span className="text-destructive">Échec de la sauvegarde en ligne.</span>
            <Button size="sm" variant="outline" onClick={() => setSaveTick((t) => t + 1)}>Réessayer</Button>
          </>
        )}
      </div>
      {currentBattery.type === "correct" || currentBattery.type === "weighted" ? (
        <McqBattery battery={currentBattery} responses={responses} setResponses={setResponses} />
      ) : currentBattery.type === "rubric" ? (
        <RubricBattery battery={currentBattery} responses={responses} setResponses={setResponses} />
      ) : (
        <CoherenceBattery battery={currentBattery} responses={responses} setResponses={setResponses} />
      )}
      <div className="mt-2 flex justify-end">
        {active < 8 && (
          <Button onClick={() => goToBattery(active + 1)}>
            Batterie suivante <ChevronRight size={15} />
          </Button>
        )}
      </div>
    </AppShell>
  );
}
