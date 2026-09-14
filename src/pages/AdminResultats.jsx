import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import UserAvatar from "../components/layout/UserAvatar.jsx";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import { useUserAuth } from "../context/UserAuthContext.jsx";
import { Menu, List, LayoutGrid, FileJson, Pencil, Trash2, Download, Database, ChevronLeft, Printer, UserPlus, Mail, Calendar, X, ArrowLeft, Check } from "lucide-react";
import {
  createAccount,
  isValidEmail,
  listAccounts,
  listImported,
  addImported,
  linkImportedToAccount,
  saveImportedResponses,
  updateAccountResponses,
  deleteAccount,
  deleteImported,
  markStaticHidden,
  listHiddenStaticFiles,
  parseCandidateImport,
} from "../lib/storage.js";
import { listImportedResults } from "../lib/imported.js";
import { buildCandidates, formatDate } from "../lib/candidates.js";
import { AXES, ROLES, DIMS, DIM, BATTERIES } from "../data/index.js";
import { exportResponsesJson, generatePdfFilename } from "../lib/export.js";
import { computeDimensionScores, computeCoherence, computeAxisScores, computeRoleFit, generateReport, accountProgress } from "../lib/scoring.js";
import { INK, LINE, MUTED } from "../lib/theme.js";
import AppShell from "../components/layout/AppShell.jsx";
import AdminSidebar from "../components/layout/AdminSidebar.jsx";
import PageTitle from "../components/ui/PageTitle.jsx";
import Button from "../components/ui/Button.jsx";
import Field from "../components/ui/Field.jsx";
import PasswordField from "../components/ui/PasswordField.jsx";
import SearchField from "../components/ui/SearchField.jsx";
import FilterDropdown from "../components/ui/FilterDropdown.jsx";
import ImportJsonButton from "../components/ui/ImportJsonButton.jsx";
import RowMenu from "../components/ui/RowMenu.jsx";
import Badge from "../components/ui/Badge.jsx";
import ProgressCircle from "../components/ui/ProgressCircle.jsx";
import ResultsView from "./ResultsView.jsx";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const NAVY = "#1B2A4A";

function ViewToggle({ value, onChange }) {
  const btn = (v, icon, label) => (
    <button key={v} onClick={() => onChange(v)} type="button" style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 12px", border: "none", fontFamily: "inherit", cursor: "pointer",
      background: value === v ? NAVY : "transparent", color: value === v ? "#fff" : MUTED, fontSize: 12.5, fontWeight: 600,
    }}>
      {icon} {label}
    </button>
  );
  return (
    <div className="view-toggle" style={{ display: "inline-flex", border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden", background: "#fff" }}>
      {btn("list", <List size={14} />, "Liste")}
      {btn("card", <LayoutGrid size={14} />, "Cartes")}
    </div>
  );
}

function Avatar({ kind, label, size }) {
  const s = size || 38;
  return (
    <div style={{ width: s, height: s, borderRadius: "50%", flexShrink: 0, background: kind === "acct" ? NAVY : "#F5EBD6", color: kind === "acct" ? "#fff" : "#7A5A15", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: s * 0.36 }}>
      {kind === "acct" ? label.charAt(0).toUpperCase() : <FileJson size={s * 0.42} />}
    </div>
  );
}

function filterList(candidates, query, filters) {
  const q = query.trim().toLowerCase();
  return candidates.filter((c) => {
    if (q && !c.search.toLowerCase().includes(q)) return false;
    if (filters.type === "acct" && c.kind !== "acct") return false;
    if (filters.type === "imp" && c.kind !== "imp") return false;
    const complete = c.progress.total > 0 && c.progress.answered === c.progress.total;
    if (filters.progress === "complete" && !complete) return false;
    if (filters.progress === "incomplete" && complete) return false;
    if (filters.metier && filters.metier !== "all") {
      const role = c.sc && c.sc.roles.find((r) => r.key === filters.metier);
      if (!role || role.fit == null || role.fit < (filters.metierMin ?? 60)) return false;
    }
    if (filters.axis && filters.axis !== "all") {
      const v = c.sc && c.sc.axes[filters.axis];
      if (v == null || v < (filters.axisMin ?? 60)) return false;
    }
    return true;
  });
}

const BASE_FILTERS = { type: "all", progress: "all", metier: "all", metierMin: 60, axis: "all", axisMin: 60 };
const METIERS = ROLES.map((r) => ({ key: r.key, name: r.name }));
const AXIS_OPTIONS = AXES.map((ax) => ({ key: ax, name: ax }));

function ResultsBlock({ candidate }) {
  return (
    <ResultsView responses={candidate.responses} />
  );
}

const INTENSITY_FR = { leger: "Léger", modere: "Modéré", fort: "Fort", none: "Non observé" };

function esc(s) {
  const str = String(s == null ? "" : s);
  return str
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"');
}

function mcqAnswersHtml(battery, responses) {
  return battery.items.map((it) => {
    const sel = responses.mcq[it.id];
    const answer = !sel ? "<span class=\"na\">Non répondue</span>"
      : it.open ? esc(sel)
        : `${esc(it.o[sel] || "")} <span class="opt">(${sel})</span>`;
    return `<li><div class="qid">${esc(it.id)} · ${esc(DIM[it.dim]?.name || "")}</div>` +
      `<div class="qtext">${esc(it.text)}</div><div class="qans">Réponse : ${answer}</div></li>`;
  }).join("");
}

function rubricAnswersHtml(battery, responses) {
  return battery.items.map((it) => {
    const data = responses.b7[it.id];
    if (!data) return `<li><div class="qid">${esc(it.id)} · Cas</div><div class="qans">Non répondue</div></li>`;
    const scores = Object.entries(data).filter(([k]) => k !== "text").map(([k, v]) =>
      v != null ? `<span class="chip">${DIM[k]?.name || k} : ${v}</span>` : "").join("");
    return `<li><div class="qid">${esc(it.id)} · Cas</div>` +
      `<div class="qtext">${esc(it.text)}</div>` +
      (data.text ? `<div class="qans"><strong>Réponse écrite :</strong><br/>${esc(data.text)}</div>` : "") +
      (scores ? `<div class="chips">${scores}</div>` : "") + "</li>";
  }).join("");
}

function coherenceAnswersHtml(battery, responses) {
  return battery.items.map((it) => {
    const data = responses.b8[it.id];
    if (!data) return `<li><div class="qid">${esc(it.id)} · Simulation</div><div class="qans">Non répondue</div></li>`;
    const chips = it.watch.map((dim) => data[dim] && data[dim] !== "none"
      ? `<span class="chip">${DIM[dim]?.name || dim} : ${INTENSITY_FR[data[dim]] || data[dim]}</span>` : "").join("");
    return `<li><div class="qid">${esc(it.id)} · Simulation</div>` +
      `<div class="qtext">${esc(it.text)}</div>` +
      (data.text ? `<div class="qans"><strong>Réponse écrite :</strong><br/>${esc(data.text)}</div>` : "") +
      (chips ? `<div class="chips">${chips}</div>` : "") + "</li>";
  }).join("");
}

function responsesHtml(responses) {
  return BATTERIES.map((b) => {
    let body;
    if (b.type === "correct" || b.type === "weighted") body = mcqAnswersHtml(b, responses);
    else if (b.type === "rubric") body = rubricAnswersHtml(b, responses);
    else body = coherenceAnswersHtml(b, responses);
    return `<h3>B${b.id} — ${esc(b.name)}</h3><ol class="answers">${body}</ol>`;
  }).join("");
}

export default function AdminResultats() {
  const { logout, adminUser } = useAdminAuth();
  const { isAdmin, hasRole } = useUserAuth();
  const navigate = useNavigate();
  const isSuperAdmin = hasRole("super_admin");
  const [accounts, setAccounts] = useState([]);
  const [staticImports, setStaticImports] = useState([]);
  const [runtimeImports, setRuntimeImports] = useState([]);
  const [sidebarQuery, setSidebarQuery] = useState("");
  const [sidebarFilters, setSidebarFilters] = useState({ ...BASE_FILTERS });
  const [pageQuery, setPageQuery] = useState("");
  const [pageFilters, setPageFilters] = useState({ ...BASE_FILTERS });
  const [viewMode, setViewMode] = useState("list");
  const [selection, setSelection] = useState(null);
  const [createdLinks, setCreatedLinks] = useState({});
  const [importMsg, setImportMsg] = useState(null);
  const [accForm, setAccForm] = useState({ open: false, email: "", password: "", error: null, busy: false });
  const [hiddenStatic, setHiddenStatic] = useState([]);
  const [updateTarget, setUpdateTarget] = useState(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [pdfExportModal, setPdfExportModal] = useState({ open: false, countdown: 10 });
  const timerRef = useRef(null);
  const selectedRef = useRef(null);
  const [pdfExportSections, setPdfExportSections] = useState({
    axes: true,
    jobs: true,
    strengths: true,
    vigilance: true,
    dimensions: true,
    responses: true,
  });

  const handleNavigate = (path) => {
    // eslint-disable-next-line react-hooks/immutability
    window.location.href = path;
  };

  useEffect(() => {
    listAccounts().then(setAccounts);
    listHiddenStaticFiles().then(setHiddenStatic).catch(() => {});
    listImportedResults().then(setStaticImports).then(() => listImported().then(setRuntimeImports));
  }, []);

  const refresh = () => {
    listHiddenStaticFiles().then(setHiddenStatic).catch(() => {});
    listAccounts().then(setAccounts);
    listImportedResults().then((s) => { setStaticImports(s); return s; }).then(() => listImported().then(setRuntimeImports));
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMobileSidebarOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileSidebarOpen]);

  const anySectionSelected = Object.values(pdfExportSections).some((v) => v);

  const openPdfExportModal = () => {
    setPdfExportSections({
      axes: true,
      jobs: true,
      strengths: true,
      vigilance: true,
      dimensions: true,
      responses: true,
    });
    setPdfExportModal({ open: true, countdown: 10 });
  };

  const closePdfExportModal = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPdfExportModal({ open: false, countdown: 10 });
  };

  const printCandidateReportWithSections = (candidate, sections) => {
    const responses = candidate.responses;
    const dimScores = computeDimensionScores(responses);
    const coherence = computeCoherence(dimScores, responses.b8);
    const axisScores = computeAxisScores(dimScores, coherence);
    const roleFit = computeRoleFit(dimScores, axisScores);
    const report = generateReport(dimScores);
    const prog = accountProgress(responses);
    const className = candidate.kind === "acct" ? "Compte" : "Importé";

    const axisRows = AXES.map((ax) =>
      `<tr><td>${ax}</td><td class="num">${axisScores[ax] != null ? axisScores[ax] : "—"}</td></tr>`).join("");

    const dimRows = DIMS
      .map((d) => `<tr><td>${esc(d.name)}</td><td>${esc(d.axis)}</td><td class="num">${dimScores[d.key] != null ? dimScores[d.key] : "—"}</td></tr>`)
      .sort((a, b) => a.localeCompare(b)).join("");

    const roleRows = roleFit.map((r) =>
      `<tr><td>${esc(r.name)}</td><td class="num">${r.fit != null ? r.fit + " %" : "—"}</td></tr>`).join("");

    let html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>${esc(generatePdfFilename(candidate).replace(/\.pdf$/, ""))}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #2A2A28; margin: 32px 44px; font-size: 13px; }
  h1 { font-size: 21px; color: #1B2A4A; margin: 0 0 4px; }
  h2 { font-size: 16px; color: #1B2A4A; border-bottom: 2px solid #B8862B; padding-bottom: 4px; margin: 26px 0 12px; }
  h3 { font-size: 13.5px; color: #1B2A4A; margin: 18px 0 8px; }
  .meta { color: #8A8578; font-size: 12px; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; }
  td, th { border: 1px solid #E4DFD0; padding: 5px 9px; text-align: left; }
  th { background: #F7F4EC; color: #1B2A4A; }
  td.num { text-align: right; font-weight: 600; }
  .na { color: #8A8578; }
  .box { border: 1px solid #E4DFD0; border-radius: 8px; padding: 10px 14px; margin: 8px 0; }
  ul { margin: 4px 0 8px 18px; padding: 0; }
  ol.answers { margin: 0; padding-left: 18px; }
  ol.answers li { margin-bottom: 10px; }
  .qid { font-weight: 700; color: #1B2A4A; }
  .qtext { color: #2A2A28; margin: 2px 0; }
  .qans { color: #6E6A5E; margin-top: 2px; white-space: pre-wrap; }
  .chips { margin-top: 4px; }
  .chip { display: inline-block; border: 1px solid #B8862B; color: #7A5A15; border-radius: 10px; padding: 1px 8px; margin: 2px 4px 2px 0; font-size: 11.5px; }
  .cols { display: table; width: 100%; }
  .cols > div { display: table-cell; width: 50%; vertical-align: top; padding-right: 12px; }
  @media print { body { margin: 12mm; } }
</style></head><body>
  <h1>NTC Assessment Center — Rapport d'évaluation</h1>
  <div class="meta">
    <strong>${esc(candidate.label)}</strong> · ${className}<br/>
    Exporté le ${new Date().toLocaleDateString("fr-FR")} — Progression : ${prog.answered}/${prog.total} réponses (${prog.pct} %)
  </div>`;

    if (sections.axes) {
      html += `
  <h2>Résultats par axe</h2>
  <table><tr><th>Axe</th><th>Score</th></tr>${axisRows}</table>
  ${coherence != null ? `<div class="box"><strong>Cohérence comportementale : ${coherence} %</strong> — écart entre le profil déclaré et le comportement observé en simulation intégrée.</div>` : ""}`;
    }

    if (sections.jobs) {
      html += `
  <h2>Correspondance aux 5 métiers</h2>
  <table><tr><th>Métier</th><th>Adéquation</th></tr>${roleRows}</table>
  <div class="meta">Modèle de pondération raisonné — indicatif, non statistiquement validé.</div>`;
    }

    if (sections.strengths || sections.vigilance) {
      html += `<div class="cols">`;
      if (sections.strengths) {
        html += `
    <div>
      <h2>Forces</h2>
      <ul>${report.strengths.map((d) => `<li><strong>${esc(d.name)}</strong> — ${d.score}</li>`).join("")}</ul>
    </div>`;
      }
      if (sections.vigilance) {
        html += `
    <div>
      <h2>Points de vigilance</h2>
      <ul>${report.watch.map((d) => `<li><strong>${esc(d.name)}</strong> — ${d.score}</li>`).join("")}</ul>
    </div>`;
      }
      html += `</div>`;
    }

    if (sections.dimensions) {
      html += `
  <h2>Détail des dimensions (44)</h2>
  <table><tr><th>Dimension</th><th>Axe</th><th>Score</th></tr>${dimRows}</table>`;
    }

    if (sections.responses) {
      html += `
  <h2>Réponses détaillées</h2>
  ${responsesHtml(responses)}`;
    }

    html += `</body></html>`;

    const win = window.open("", "_blank");
    if (!win) {
      alert("Autorisez les fenêtres contextuelles puis réessayez pour exporter le PDF.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 400);
  };

  const handlePdfExportOk = useCallback(() => {
    if (!anySectionSelected) return;
    closePdfExportModal();
    printCandidateReportWithSections(selectedRef.current, pdfExportSections);
  }, [anySectionSelected, closePdfExportModal, pdfExportSections]);

  useEffect(() => {
    if (!pdfExportModal.open) return;
    const timer = setInterval(() => {
      setPdfExportModal((prev) => {
        if (prev.countdown <= 1) {
          if (anySectionSelected) {
            handlePdfExportOk();
          }
          return { ...prev, countdown: 0 };
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);
    timerRef.current = timer;
    return () => clearInterval(timer);
  }, [pdfExportModal.open, anySectionSelected, handlePdfExportOk]);

  const candidates = buildCandidates({ accounts, staticImports, runtimeImports, hiddenStatic });

  const sidebarList = filterList(candidates, sidebarQuery, sidebarFilters);
  const pageList = filterList(candidates, pageQuery, pageFilters);
  const pageHasCriteria = Boolean(pageQuery.trim() || pageFilters.type !== "all" || pageFilters.progress !== "all" || pageFilters.metier !== "all" || pageFilters.axis !== "all");
  const selected = selection ? candidates.find((c) => c.id === selection.id) || null : null;
  const linkedEmail = selected ? selected.linked || createdLinks[selected.id] || null : null;

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const openCandidate = (c) => {
    setSelection({ id: c.id });
    setAccForm({ open: false, email: "", password: "", error: null, busy: false });
    setMobileSidebarOpen(false);
  };
  const goBack = () => { setSelection(null); setImportMsg(null); };

  const handleImport = async (text, name) => {
    if (text == null) { setImportMsg({ ok: false, text: "Impossible de lire le fichier sélectionné." }); return; }
    const records = parseCandidateImport(text, name);
    if (!records || records.length === 0) {
      setImportMsg({ ok: false, text: "Aucune réponse exploitable ({ mcq, b7, b8 }) dans ce JSON." });
      return;
    }
    const now = new Date().toISOString();
    for (const r of records) {
      await addImported({ id: uid(), label: r.label, email: r.email || null, responses: r.responses, createdAt: now });
    }
    setImportMsg({ ok: true, text: `${records.length} candidat${records.length > 1 ? "s" : ""} importé${records.length > 1 ? "s" : ""}.` });
    refresh();
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    const email = accForm.email.trim();
    if (!isValidEmail(email)) { setAccForm((f) => ({ ...f, error: "Adresse email invalide." })); return; }
    if (accForm.password.length < 4) { setAccForm((f) => ({ ...f, error: "Le mot de passe doit contenir au moins 4 caractères." })); return; }
    setAccForm((f) => ({ ...f, busy: true, error: null }));
    const res = await createAccount(email, accForm.password, selected.responses);
    if (res.error) { setAccForm((f) => ({ ...f, error: res.error, busy: false })); return; }
    if (selected.kind === "imp" && !selected.data.file) await linkImportedToAccount(selected.data.id, email);
    setCreatedLinks((prev) => ({ ...prev, [selected.id]: email }));
    setAccForm({ open: false, email: "", password: "", error: null, busy: false });
    refresh();
  };

  const applyUpdateResults = async (target, text, name) => {
    setUpdateTarget(null);
    if (text == null) { setImportMsg({ ok: false, text: "Impossible de lire le fichier sélectionné." }); return; }
    const records = parseCandidateImport(text, name);
    if (!records || records.length === 0) {
      setImportMsg({ ok: false, text: "Aucune réponse exploitable ({ mcq, b7, b8 }) dans ce JSON." });
      return;
    }
    const rec = records[0];
    if (target.kind === "acct") {
      const ok = await updateAccountResponses(target.data.email, rec.responses);
      if (!ok) { setImportMsg({ ok: false, text: "Compte introuvable — réponses non mises à jour." }); return; }
    } else if (target.isStatic || (target.kind === "imp" && !target.data.id)) {
      await markStaticHidden(target.file);
      const now = new Date().toISOString();
      await addImported({ id: uid(), label: rec.label || target.label, email: rec.email || null, responses: rec.responses, createdAt: now });
    } else if (target.kind === "imp" && target.data.id) {
      const ok = await saveImportedResponses(target.data.id, rec.responses, rec.label || null);
      if (!ok) { setImportMsg({ ok: false, text: "Import introuvable — réponses non mises à jour." }); return; }
    }
    setImportMsg({ ok: true, text: records.length > 1
      ? `${records.length} candidats dans le fichier — seule la première entrée a été appliquée (réponses de « ${target.label} » mises à jour).`
      : `Réponses de « ${target.label} » mises à jour avec succès.` });
    refresh();
  };

  const handleDeleteCandidate = (c) => {
    if (!window.confirm(`Supprimer définitivement « ${c.label} » ?${c.kind === "acct" ? " Le compte et ses réponses seront supprimés." : ""}`)) return;
    (async () => {
      if (c.kind === "acct") {
        await deleteAccount(c.data.email);
      } else if (c.isStatic || (c.kind === "imp" && !c.data.id)) {
        await markStaticHidden(c.file);
      } else if (c.kind === "imp" && c.data.id) {
        await deleteImported(c.data.id);
      }
      setImportMsg({ ok: true, text: `« ${c.label} » a été supprimé.` });
      if (selection?.id === c.id) goBack();
      refresh();
    })();
  };

  const candidateMenuItems = (c) => [
    { label: "Mettre à jour…", icon: <Pencil size={14} />, onClick: () => setUpdateTarget(c) },
    { label: "Supprimer", icon: <Trash2 size={14} />, danger: true, onClick: () => handleDeleteCandidate(c) },
  ];
  const detailMenuItems = (c) => [
    { label: "Exporter JSON", icon: <Download size={14} />, onClick: () => exportResponsesJson(c) },
{ label: "Voir les réponses (mode test)", icon: <Database size={14} />, onClick: () => navigate(`/admin/mode-test/${encodeURIComponent(c.id)}`) },
    { label: "Mettre à jour…", icon: <Pencil size={14} />, onClick: () => setUpdateTarget(c) },
    { label: "Supprimer", icon: <Trash2 size={14} />, danger: true, onClick: () => handleDeleteCandidate(c) },
  ];

  const acctMeta = selected?.data;
  const hasData = selected && selected.progress.answered > 0;
  const sidebarProps = {
    candidates: sidebarList,
    onSelect: openCandidate,
    selectedId: selection?.id || null,
    onLogout: handleLogout,
    onHome: goBack,
    onNavigate: handleNavigate,
    query: sidebarQuery,
    onQueryChange: setSidebarQuery,
    filters: sidebarFilters,
    onFilters: setSidebarFilters,
    metiers: METIERS,
    axes: AXIS_OPTIONS,
  };

  const SECTIONS = [
    { key: "axes", label: "Résultats par axe", description: "Scores des 8 axes (Radar)" },
    { key: "jobs", label: "Correspondance aux 5 métiers", description: "Adéquation aux 5 métiers" },
    { key: "strengths", label: "Forces", description: "Points forts identifiés" },
    { key: "vigilance", label: "Points de vigilance", description: "Points de vigilance identifiés" },
    { key: "dimensions", label: "Détail des dimensions", description: "Scores des 44 dimensions" },
    { key: "responses", label: "Réponses détaillées", description: "Réponses aux batteries de tests" },
  ];

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
        <UserAvatar onNavigate={(path) => window.location.href = path} />
      </div>
      {!selected ? (
        <>
          <PageTitle
            title="Candidats"
            subtitle={pageHasCriteria ? `${pageList.length} affiché${pageList.length > 1 ? "s" : ""} (vue filtrée) sur ${candidates.length}` : `${candidates.length} candidat${candidates.length > 1 ? "s" : ""}`}
          />
          <div className="admin-toolbar" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: importMsg ? 10 : 20 }}>
            <FilterDropdown filters={pageFilters} onFilters={setPageFilters} metiers={METIERS} axes={AXIS_OPTIONS} />
            <SearchField value={pageQuery} onChange={setPageQuery} placeholder="Rechercher par nom ou email…" />
            <div className="admin-toolbar__actions" style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              {isSuperAdmin && (
                <Button variant="outline" size="sm" onClick={() => handleNavigate("/super-admin")}>
                  <ArrowLeft size={14} /> Retour à l'espace Super Admin
                </Button>
              )}
              <ViewToggle value={viewMode} onChange={setViewMode} />
              <ImportJsonButton onImport={handleImport}>Importer un JSON</ImportJsonButton>
            </div>
          </div>
          {importMsg && (
            <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 8, fontSize: 13, background: importMsg.ok ? "#E3F0E4" : "#FAE8E6", color: importMsg.ok ? "#2E6B3C" : "#8A2B22" }}>{importMsg.text}</div>
          )}
          {pageList.length === 0 ? (
            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: "40px 30px", textAlign: "center", color: MUTED, fontSize: 13.5, lineHeight: 1.7 }}>
              {candidates.length === 0
                ? "Aucun candidat pour le moment. Utilisez « Importer un JSON » pour ajouter des résultats, ou laissez les candidats s'inscrire via /inscription."
                : "Aucun candidat ne correspond à la recherche ou aux filtres actuels."}
            </div>
          ) : viewMode === "list" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pageList.map((c) => (
                <div key={c.id} role="button" tabIndex={0} onClick={() => openCandidate(c)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openCandidate(c); }}
                  className="admin-list-row"
                  style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${LINE}`, background: "#fff", cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "border-color .15s, box-shadow .15s" }}>
                  <Avatar kind={c.kind} label={c.label} />
                  <div className="admin-list-row__main" style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{c.meta}</div>
                  </div>
                  <div className="admin-list-row__side" style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
                    <Badge tone={c.badgeTone}>{c.badge}</Badge>
                    <ProgressCircle done={c.progress.answered} total={c.progress.total} color={NAVY}>
                      <span style={{ fontSize: 9.5, color: NAVY }}>{c.progress.pct}%</span>
                    </ProgressCircle>
                    <RowMenu items={candidateMenuItems(c)} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 }}>
              {pageList.map((c) => (
                <div key={c.id} role="button" tabIndex={0} onClick={() => openCandidate(c)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openCandidate(c); }}
                  style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, borderRadius: 12, border: `1px solid ${LINE}`, background: "#fff", cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "border-color .15s, box-shadow .15s" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <Avatar kind={c.kind} label={c.label} />
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Badge tone={c.badgeTone}>{c.badge}</Badge>
                      <RowMenu items={candidateMenuItems(c)} />
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</div>
                  <div style={{ fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.meta}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
                    <ProgressCircle done={c.progress.answered} total={c.progress.total} color={NAVY}>
                      <span style={{ fontSize: 9.5, color: NAVY }}>{c.progress.pct}%</span>
                    </ProgressCircle>
                    <span style={{ fontSize: 12, color: MUTED }}>{c.progress.answered}/{c.progress.total} réponses</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <button onClick={goBack} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: MUTED, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 4, fontFamily: "inherit" }}>
            <ChevronLeft size={16} /> Retour à la liste
          </button>
          <PageTitle
            title={selected.label}
            right={
              <div className="candidate-header-actions" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Button size="sm" onClick={openPdfExportModal}>
                  <Printer size={14} /> Exporter PDF
                </Button>

                <RowMenu items={detailMenuItems(selected)} />
              </div>
            }
            subtitle={
              <div className="candidate-header-subtitle" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Badge tone={selected.badgeTone}>
                  {selected.badge}
                </Badge>

                <span>
                  {selected.kind === "acct"
                    ? `Inscrit le ${formatDate(acctMeta.createdAt)} · Dernière activité ${formatDate(acctMeta.updatedAt)}`
                    : (selected.data.file
                        ? `Fichier ${selected.data.file}`
                        : selected.meta)}
                </span>
              </div>
            }
          />

          {selected.kind === "imp" && (
            <div style={{ marginBottom: 16 }}>
              {linkedEmail ? (
                <div style={{ background: "#E3F0E4", border: "1px solid #BFE0C4", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#2E6B3C" }}>
                  <strong>Compte lié :</strong> {linkedEmail} — ce candidat peut se connecter via /connexion.
                </div>
              ) : accForm.open ? (
                <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "16px 18px" }}>
                  <form onSubmit={handleCreateAccount}>
                    <Field label="Email du compte" type="email" placeholder="candidat@exemple.org" value={accForm.email}
                      onChange={(e) => setAccForm((f) => ({ ...f, email: e.target.value }))} />
                    <PasswordField label="Mot de passe" placeholder="Au moins 4 caractères" value={accForm.password}
                      onChange={(e) => setAccForm((f) => ({ ...f, password: e.target.value }))} />
                    {accForm.error && <div style={{ marginBottom: 10, fontSize: 12.5, color: "#8A2B22" }}>{accForm.error}</div>}
                    <div style={{ display: "flex", gap: 10 }}>
                      <Button type="submit" disabled={accForm.busy} size="sm">
                        <UserPlus size={14} /> Créer le compte
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setAccForm((f) => ({ ...f, open: false, error: null }))}>Annuler</Button>
                    </div>
                  </form>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setAccForm((f) => ({ ...f, open: true }))}>
                  <UserPlus size={14} /> Créer un compte pour ce candidat
                </Button>
              )}
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12.5, color: MUTED, marginBottom: 18 }}>
            {selected.kind === "acct" ? (
              <>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Mail size={13} /> {selected.label}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Calendar size={13} /> Inscrit le {formatDate(acctMeta.createdAt)}</span>
              </>
            ) : (
              <span><FileJson size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} /> {selected.meta}</span>
            )}
            <span><strong style={{ color: INK }}>{selected.progress.answered}/{selected.progress.total}</strong> réponses enregistrées</span>
          </div>

          {importMsg && (
            <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 8, fontSize: 13, background: importMsg.ok ? "#E3F0E4" : "#FAE8E6", color: importMsg.ok ? "#2E6B3C" : "#8A2B22" }}>{importMsg.text}</div>
          )}

          {!hasData ? (
            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 30, textAlign: "center", color: MUTED, fontSize: 13.5 }}>
              {selected.kind === "acct" ? "Ce compte n'a encore fourni aucune réponse au test." : "Ce candidat importé ne contient aucune réponse exploitable au test."}
            </div>
          ) : (
<ResultsBlock candidate={selected} />
          )}
        </>
      )}
      {updateTarget && (
        <div className="update-modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(20,26,40,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setUpdateTarget(null)}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "20px 22px", maxWidth: 440, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Pencil size={16} color={NAVY} />
              <div style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>Mettre à jour les réponses</div>
            </div>
            <p style={{ fontSize: 13, color: "#6E6A5E", lineHeight: 1.6, margin: "6px 0 14px" }}>
              Les réponses de <strong>{updateTarget.label}</strong> seront remplacées par le contenu d'un nouveau fichier JSON.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <ImportJsonButton onImport={(text, name) => applyUpdateResults(updateTarget, text, name)}>Choisir un fichier JSON…</ImportJsonButton>
              <Button variant="ghost" size="sm" onClick={() => setUpdateTarget(null)}>Annuler</Button>
            </div>
          </div>
        </div>
      )}
      {pdfExportModal.open && (
        <div className="pdf-export-modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(20,26,40,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={closePdfExportModal}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "24px", maxWidth: 440, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: NAVY }}>Exporter le rapport PDF</div>
              <button type="button" onClick={closePdfExportModal} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: MUTED, padding: 0, lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Sélectionnez les sections à inclure dans le rapport.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {SECTIONS.map((section) => (
                <label key={section.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: `1px solid ${LINE}`, borderRadius: 10, cursor: "pointer", background: pdfExportSections[section.key] ? "#FEFBF3" : "#fff", transition: "all .15s" }}>
                  <input
                    type="checkbox"
                    checked={pdfExportSections[section.key]}
                    onChange={() => setPdfExportSections((prev) => ({ ...prev, [section.key]: !prev[section.key] }))}
                    style={{ width: 20, height: 20, accentColor: NAVY, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>{section.label}</div>
                    <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{section.description}</div>
                  </div>
                </label>
              ))}
            </div>
            {!anySectionSelected && (
              <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "#FEF3E2", border: `1px solid #F5C6C3`, color: "#B5652E", fontSize: 13 }}>
                Sélectionnez au moins une section pour générer le rapport.
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <div style={{ fontSize: 13, color: MUTED }}>
                {pdfExportModal.countdown > 0 && `Export automatique dans ${pdfExportModal.countdown} s`}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost" size="sm" onClick={closePdfExportModal}>Annuler</Button>
                <Button size="sm" onClick={handlePdfExportOk} disabled={!anySectionSelected}>
                  <Check size={14} /> OK
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}