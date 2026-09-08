import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ChevronLeft, Menu, X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { listAccounts, listHiddenStaticFiles, listImported } from "../lib/storage.js";
import { listImportedResults } from "../lib/imported.js";
import { accountProgress, computeAxisScores, computeCoherence, computeDimensionScores, computeRoleFit } from "../lib/scoring.js";
import { INK, MUTED } from "../lib/theme.js";
import AppShell from "../components/layout/AppShell.jsx";
import AdminSidebar from "../components/layout/AdminSidebar.jsx";
import PageTitle from "../components/ui/PageTitle.jsx";
import Button from "../components/ui/Button.jsx";
import Badge from "../components/ui/Badge.jsx";
import ResponsesReview from "../components/question/ResponsesReview.jsx";

function computeCandidateScoring(responses) {
  if (!responses || typeof responses !== "object") return { axes: {}, roles: [] };
  const dims = computeDimensionScores(responses);
  const coherence = computeCoherence(dims, responses.b8);
  const axes = computeAxisScores(dims, coherence);
  return { axes, roles: computeRoleFit(dims, axes) };
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function buildCandidateList(accounts, staticImports, runtimeImports, hiddenStatic) {
  const safeResponses = (r) => (r && typeof r === "object" ? r : { mcq: {}, b7: {}, b8: {} });
  return [
    ...accounts.map((a) => ({
      kind: "acct",
      id: "acct:" + a.email,
      label: a.email,
      badge: "Compte",
      badgeTone: "compte",
      meta: `Inscrit le ${formatDate(a.createdAt)}`,
      responses: safeResponses(a.responses),
      progress: accountProgress(a.responses),
      sc: computeCandidateScoring(a.responses),
      search: `${a.email} ${a.email}`,
      data: a,
    })),
    ...staticImports.filter((f) => !hiddenStatic.includes(f.file)).map((f) => ({
      kind: "imp",
      id: "imp:static:" + f.file,
      label: f.name,
      badge: "Importé",
      badgeTone: "import",
      meta: `Fichier ${f.file}`,
      responses: safeResponses(f.responses),
      progress: accountProgress(f.responses),
      sc: computeCandidateScoring(f.responses),
      search: `${f.name} ${f.file}`,
      data: f,
      isStatic: true,
      file: f.file,
    })),
    ...runtimeImports.map((im) => ({
      kind: "imp",
      id: "imp:" + im.id,
      label: im.label,
      badge: "Importé",
      badgeTone: "import",
      meta: im.email || `Importé le ${formatDate(im.importedAt || im.createdAt)}`,
      responses: safeResponses(im.responses),
      progress: accountProgress(im.responses),
      sc: computeCandidateScoring(im.responses),
      search: `${im.label} ${im.email || ""}`,
      data: im,
      linked: im.accountEmail || null,
    })),
  ];
}

function findCandidateById(candidates, id) {
  return candidates.find((c) => c.id === id) || null;
}

export default function AdminResponses() {
  const { candidateId } = useParams();
  const location = useLocation();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [candidate, setCandidate] = useState(location.state?.candidate || null);
  const [loading, setLoading] = useState(!location.state?.candidate);
  const [notFound, setNotFound] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarQuery, setSidebarQuery] = useState("");
  const [sidebarFilters, setSidebarFilters] = useState({ type: "all", progress: "all", metier: "all", metierMin: 60, axis: "all", axisMin: 60 });
  const [accounts, setAccounts] = useState([]);
  const [staticImports, setStaticImports] = useState([]);
  const [runtimeImports, setRuntimeImports] = useState([]);
  const [hiddenStatic, setHiddenStatic] = useState([]);

  useEffect(() => {
    listAccounts().then(setAccounts);
    listHiddenStaticFiles().then(setHiddenStatic).catch(() => {});
    listImportedResults().then(setStaticImports).then(() => listImported().then(setRuntimeImports));
  }, []);

  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;
    const onKeyDown = (e) => { if (e.key === "Escape") setMobileSidebarOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileSidebarOpen]);

  useEffect(() => {
    if (candidate) return;
    let cancelled = false;
    (async () => {
      const allAccounts = await listAccounts();
      const hidden = await listHiddenStaticFiles().catch(() => []);
      const staticRes = await listImportedResults();
      const runtimeRes = await listImported();
      const candidates = buildCandidateList(allAccounts, staticRes, runtimeRes, hidden);
      const found = findCandidateById(candidates, candidateId);
      if (cancelled) return;
      if (found) {
        setCandidate(found);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [candidateId, candidate]);

  const handleLogout = () => { logout(); navigate("/login"); };
  const goBack = () => navigate("/admin", { state: { selectedId: candidateId } });

  const candidates = buildCandidateList(accounts, staticImports, runtimeImports, hiddenStatic);

  const sidebarProps = {
    candidates,
    onSelect: (c) => navigate("/admin/reponses/" + encodeURIComponent(c.id), { state: { candidate: c } }),
    selectedId: candidateId,
    onLogout: handleLogout,
    onHome: () => navigate("/admin"),
    query: sidebarQuery,
    onQueryChange: setSidebarQuery,
    filters: sidebarFilters,
    onFilters: setSidebarFilters,
    metiers: [],
    axes: [],
  };

  return (
    <AppShell maxWidth={1000} sidebar={
      <div className="app-sidebar-desktop">
        <AdminSidebar {...sidebarProps} />
      </div>
    }>
      {mobileSidebarOpen && (
        <>
          <button type="button" aria-label="Fermer le menu administrateur" className="app-sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} />
          <aside id="app-mobile-sidebar-drawer" className="app-sidebar-drawer" role="dialog" aria-modal="true" aria-label="Navigation administrateur">
            <div className="app-sidebar-drawer__header">
              <button type="button" className="app-sidebar-drawer__close" onClick={() => setMobileSidebarOpen(false)}>
                <X size={18} />
                <span>Fermer</span>
              </button>
            </div>
            <AdminSidebar {...sidebarProps} />
          </aside>
        </>
      )}
      <div className="app-mobile-topbar">
        <button
          type="button"
          className="app-mobile-sidebar-toggle"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Ouvrir le menu administrateur"
          aria-controls="app-mobile-sidebar-drawer"
          aria-expanded={mobileSidebarOpen}
        >
          <Menu size={18} />
          <span>Menu</span>
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 30, textAlign: "center", color: MUTED, fontSize: 13 }}>Chargement…</div>
      ) : notFound ? (
        <div style={{ padding: 30, textAlign: "center", color: MUTED, fontSize: 13.5 }}>
          <p>Candidat introuvable.</p>
          <Button variant="ghost" size="sm" onClick={goBack} style={{ marginTop: 10 }}>
            <ChevronLeft size={14} /> Retour à la liste
          </Button>
        </div>
      ) : (
        <>
          <button onClick={goBack} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: MUTED, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 4, fontFamily: "inherit" }}>
            <ChevronLeft size={16} /> Retour aux résultats
          </button>
          <PageTitle
            title={candidate.label + " — Réponses"}
            right={
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Button size="sm" onClick={goBack}>
                  <ChevronLeft size={14} /> Voir les résultats
                </Button>
              </div>
            }
            subtitle={
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Badge tone={candidate.badgeTone}>{candidate.badge}</Badge>
                <span>{candidate.kind === "acct" ? `Inscrit le ${formatDate(candidate.data.createdAt)}` : candidate.meta}</span>
                <span><strong style={{ color: INK }}>{candidate.progress.answered}/{candidate.progress.total}</strong> réponses</span>
              </div>
            }
          />
          <div style={{ marginTop: 4 }}>
            <ResponsesReview responses={candidate.responses} />
          </div>
        </>
      )}
    </AppShell>
  );
}
