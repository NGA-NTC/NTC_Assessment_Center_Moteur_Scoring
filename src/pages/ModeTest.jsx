import { useState, useEffect } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import { BATTERIES } from "../data/index.js";
import { listAccounts, listImported, listHiddenStaticFiles } from "../lib/storage.js";
import { listImportedResults } from "../lib/imported.js";
import { buildCandidates } from "../lib/candidates.js";
import AppShell from "../components/layout/AppShell.jsx";
import Sidebar from "../components/layout/BatterySidebar.jsx";
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

  const handleLogout = () => { logout(); navigate("/login"); };
  const currentBattery = BATTERIES.find((b) => b.id === active);

  const goBattery = (bId) => {
    setActive(bId);
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
      <AppShell maxWidth={900} sidebar={sidebar}>
        <PageTitle title="Mode test" subtitle="Relecture des réponses d'un candidat (lecture seule)" />
        {ready && (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-[13.5px] leading-[1.7] text-muted-foreground">
            Candidat introuvable ou supprimé.
          </div>
        )}
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth={900} sidebar={sidebar}>
      <PageTitle
        title={`Batterie ${currentBattery.id}`}
        subtitle={currentBattery.name}
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
        <span className="font-bold text-foreground">{candidate.label}</span>
        <span>·</span>
        <span>Relecture des réponses telles qu'affichées durant le test (lecture seule).</span>
      </div>
      <ResponsesReview responses={candidate.responses} batteryId={active} />
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