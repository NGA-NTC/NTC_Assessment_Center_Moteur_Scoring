import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useUserAuth } from "../context/user-auth-hooks.js";
import { useEffectiveAuthority } from "../hooks/auth/useEffectiveAuthority.js";
import { supabase } from "../lib/supabaseClient.js";
import { List, LayoutGrid, FileJson, Pencil, Trash2, Download, Database, ChevronLeft, Printer, UserPlus, Mail, Calendar, ArrowLeft, Check } from "lucide-react";
import {
  isValidEmail,
  listAccounts,
  listImported,
  addImported,
  saveImportedResponses,
  updateAccountResponses,
  deleteAccount,
  deleteImported,
  markStaticHidden,
  listHiddenStaticFiles,
  parseCandidateImport,
  ensureLocalAccount,
} from "../lib/storage.js";
import { listImportedResults } from "../lib/imported.js";
import { buildCandidates, formatDate, computeCandidateScoring } from "../lib/candidates.js";
import { AXES, ROLES, DIMS, DIM, BATTERIES } from "../data/index.js";
import { exportResponsesJson, generatePdfFilename } from "../lib/export.js";
import { computeDimensionScores, computeCoherence, computeAxisScores, computeRoleFit, generateReport, accountProgress, emptyResponses } from "../lib/scoring.js";
import AppShell from "../components/layout/AppShell.jsx";
import AppSidebar from "../components/layout/AppSidebar.jsx";
import PageTitle from "../components/ui/PageTitle.jsx";
import Button from "../components/ui/Button.jsx";
import Field from "../components/ui/Field.jsx";
import PasswordField from "../components/ui/PasswordField.jsx";
import SearchField from "../components/ui/SearchField.jsx";
import FilterDropdown from "../components/ui/FilterDropdown.jsx";
import ImportJsonButton from "../components/ui/ImportJsonButton.jsx";
import RowMenu from "../components/ui/RowMenu.jsx";
import Modal from "../components/ui/Modal.jsx";
import ConfirmDialog from "../components/common/ConfirmDialog.jsx";
import CheckboxField from "../components/common/CheckboxField.jsx";
import { createCandidateAccount } from "../services/auth/candidates/createCandidateAccount.js";
import { listUsers } from "../services/auth/users/index.js";
import Badge from "../components/ui/Badge.jsx";
import ProgressCircle from "../components/ui/ProgressCircle.jsx";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/primitives/toggle-group.jsx";
import { cn } from "@/lib/utils";
import ResultsView from "./ResultsView.jsx";
import { EmptyState } from "../components/ui/States.jsx";
import { ASSESSMENT_ID, getOrCreateAttempt, deleteAttempt } from "../services/assessments/attempts.js";
import { saveResponses } from "../services/assessments/responses.js";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* P3-S8 : replatissage d'une ligne assessment_responses dans la forme
   applicative { mcq, b7, b8 } (même encodage des question_id que le service
   src/services/assessments/responses.js). */
function applyResponseRow(shape, qid, answer) {
  if (qid.startsWith("mcq:")) { shape.mcq[qid.slice(4)] = answer; return; }
  const sep = qid.lastIndexOf(":");
  if (sep <= 0) return;
  if (qid.startsWith("b7:")) {
    const caseId = qid.slice(3, sep);
    const dimKey = qid.slice(sep + 1);
    shape.b7[caseId] = shape.b7[caseId] || {};
    shape.b7[caseId][dimKey] = answer;
  } else if (qid.startsWith("b8:")) {
    const itemId = qid.slice(3, sep);
    const key = qid.slice(sep + 1);
    shape.b8[itemId] = shape.b8[itemId] || {};
    shape.b8[itemId][key] = answer;
  }
}

function attemptShape(row) {
  return {
    id: row.id,
    userId: row.user_id,
    assessmentId: row.assessment_id,
    status: row.status,
    currentQuestionId: row.current_question_id ?? null,
    lastActivityAt: row.last_activity_at,
  };
}

/* P3-S4 : constantes de thème héritées (NAVY, INK, LINE, MUTED, SURFACE,
   SUCCESS_SOFT, SUCCESS_BORDER) supprimées — remplacées par les classes
   utilitaires Tailwind exposées depuis les tokens shadcn (index.css).

   P3-S8 : la source de vérité des réponses est Supabase
   (profiles + assessment_attempts + assessment_responses). L'ancien store
   local (ntc_users) n'est plus affiché dès que les données en ligne sont
   chargées ; il reste listé en repli si Supabase est indisponible. */

/* Feuille de style du rapport PDF exporté (document autonome, hors écran).
   Exception documentée : couleurs codées en dur (hex) — le PDF est un
   document "papier" autonome, indépendant du thème clair/sombre applicatif,
   déclaré via <style> dans un document HTML détaché (aucun impact écran). */
const PDF_PRINT_CSS = `* { box-sizing: border-box; }
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
  @media print { body { margin: 12mm; } }`;

function ViewToggle({ value, onChange }) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => { if (v) onChange(v); }}
      aria-label="Mode d'affichage"
      className="rounded-md border border-border bg-card"
    >
      <ToggleGroupItem
        value="list"
        aria-label="Vue liste"
        className="h-9 cursor-pointer gap-1.5 rounded-md px-3 text-[12.5px] font-semibold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        <List size={14} /> Liste
      </ToggleGroupItem>
      <ToggleGroupItem
        value="card"
        aria-label="Vue cartes"
        className="h-9 cursor-pointer gap-1.5 rounded-md px-3 text-[12.5px] font-semibold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        <LayoutGrid size={14} /> Cartes
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

function Avatar({ kind, label, size }) {
  const s = size || 38;
  /* Valeurs calculées (taille dynamique, icône proportionnelle) : inline
     styles justifiés — la partie statique est en classes Tailwind. */
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: s,
        height: s,
        fontSize: s * 0.36,
        background: kind === "acct" ? "var(--primary)" : "var(--secondary)",
        color: kind === "acct" ? "var(--primary-foreground)" : "var(--secondary-foreground)",
      }}
    >
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

/* Sérialisation pour l'export PDF (HTML autonome, hors écran) — inchangée. */
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
  const { hasRole } = useUserAuth();
  const { can } = useEffectiveAuthority();
  const navigate = useNavigate();
  const isSuperAdmin = hasRole("super_admin");
  const canEditUsers = can("users.manage");
  const [accounts, setAccounts] = useState([]);
  const [staticImports, setStaticImports] = useState([]);
  const [runtimeImports, setRuntimeImports] = useState([]);
  const [pageQuery, setPageQuery] = useState("");
  const [pageFilters, setPageFilters] = useState({ ...BASE_FILTERS });
  const [viewMode, setViewMode] = useState("list");
  const [selection, setSelection] = useState(null);
  const [createdLinks, setCreatedLinks] = useState({});
  const [accForm, setAccForm] = useState({ open: false, email: "", password: "", error: null, busy: false });
  const [hiddenStatic, setHiddenStatic] = useState([]);
  const [updateTarget, setUpdateTarget] = useState(null);
  const [pdfExportModal, setPdfExportModal] = useState({ open: false, countdown: 10 });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [users, setUsers] = useState([]);
  const [attemptsByUser, setAttemptsByUser] = useState({});
  const [responsesByUser, setResponsesByUser] = useState({});
  const [responsesLoaded, setResponsesLoaded] = useState(false);
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
    window.location.href = path;
  };

  useEffect(() => {
    listAccounts().then(setAccounts);
    listHiddenStaticFiles().then(setHiddenStatic).catch(() => {});
    listImportedResults().then(setStaticImports).then(() => listImported().then(setRuntimeImports));
    (async () => {
      // 1) RPC admin_get_users (SECURITY DEFINER, pattern du projet) ;
      // 2) repli : lecture directe de profiles (si RLS l'accorde) ;
      // 3) sinon : données locales uniquement (message affiché).
      // NB : profiles expose sa clé sous `id` (référence auth.users), pas
      // `user_id` — normalisation à la lecture.
      try {
        setUsers(await listUsers());
      } catch (rpcError) {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("id, email, first_name, last_name, created_at")
            .order("created_at", { ascending: true });
          if (error) throw error;
          if (!data || data.length === 0) throw rpcError;
          setUsers(data.map((p) => ({
            user_id: p.id,
            email: p.email,
            first_name: p.first_name,
            last_name: p.last_name,
            created_at: p.created_at,
          })));
        } catch (e2) {
          console.error("Chargement des profils impossible :", e2);
          toast.error("Impossible de charger les comptes candidats depuis Supabase.");
        }
      }
    })();
  }, []);

  // Tentatives + réponses en ligne. La RLS est le garde-fou côté serveur :
  // on tente toujours la lecture (profils chargés), et on replie sur les
  // données locales si elle n'est pas accordée.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (users.length === 0) return;
      try {
        const [attRes, respRes] = await Promise.all([
          supabase.from("assessment_attempts").select("*"),
          supabase.from("assessment_responses").select("attempt_id, question_id, answer"),
        ]);
        if (attRes.error) throw attRes.error;
        if (respRes.error) throw respRes.error;
        if (cancelled) return;
        const byUser = {};
        (attRes.data ?? []).forEach((row) => {
          if (row.assessment_id !== ASSESSMENT_ID) return;
          if (!byUser[row.user_id]) byUser[row.user_id] = attemptShape(row);
        });
        const byAttempt = {};
        Object.values(byUser).forEach((a) => { byAttempt[a.id] = a; });
        const respByUser = {};
        (respRes.data ?? []).forEach((r) => {
          const attempt = byAttempt[r.attempt_id];
          if (!attempt) return;
          const shape = respByUser[attempt.userId] || emptyResponses();
          applyResponseRow(shape, r.question_id, r.answer);
          respByUser[attempt.userId] = shape;
        });
        setAttemptsByUser(byUser);
        setResponsesByUser(respByUser);
        setResponsesLoaded(true);
      } catch (e) {
        console.error("Chargement des réponses en ligne impossible :", e);
        if (!cancelled) {
          toast.error("Impossible de charger les réponses en ligne — affichage limité aux données locales.");
          setResponsesLoaded(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [users]);

  const refresh = () => {
    listHiddenStaticFiles().then(setHiddenStatic).catch(() => {});
    listAccounts().then(setAccounts);
    listImportedResults().then((s) => { setStaticImports(s); return s; }).then(() => listImported().then(setRuntimeImports));
    (async () => {
      try {
        setUsers(await listUsers());
      } catch (e) {
        console.error("Rafraîchissement des profils impossible :", e);
      }
    })();
  };

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

  const closePdfExportModal = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPdfExportModal({ open: false, countdown: 10 });
  }, []);

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
  ${PDF_PRINT_CSS}
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
      toast.error("Autorisez les fenêtres contextuelles puis réessayez pour exporter le PDF.");
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

  // P3-S8 : comptes plateforme depuis Supabase — visibles immédiatement,
  // même avec 0 réponse (progression 0 %). Le store local n'est affiché
  // qu'en repli (Supabase indisponible) pour éviter deux sources de vérité.
  const supabaseCandidates = responsesLoaded ? users.map((u) => {
    const responses = responsesByUser[u.user_id] || emptyResponses();
    const label = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;
    const attempt = attemptsByUser[u.user_id] || null;
    const statusLabel = attempt
      ? attempt.status === "completed" ? "Complété" : attempt.status === "abandoned" ? "Abandonné" : "En cours"
      : "Non commencé";
    return {
      kind: "supabase",
      id: "supabase:" + u.user_id,
      label,
      badge: "Compte",
      badgeTone: "compte",
      meta: `Inscrit le ${formatDate(u.created_at)} · ${statusLabel}`,
      responses,
      progress: accountProgress(responses),
      sc: computeCandidateScoring(responses),
      search: `${label} ${u.email}`,
      email: u.email,
      data: { userId: u.user_id, email: u.email, createdAt: u.created_at, attempt },
    };
  }) : [];

  const candidates = buildCandidates({
    supabaseCandidates,
    accounts: responsesLoaded ? accounts : [],
    staticImports,
    runtimeImports,
    hiddenStatic,
  });

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
  };
  const goBack = () => { setSelection(null); };

  const handleImport = async (text, name) => {
    if (text == null) { toast.error("Impossible de lire le fichier sélectionné."); return; }
    const records = parseCandidateImport(text, name);
    if (!records || records.length === 0) {
      toast.error("Aucune réponse exploitable ({ mcq, b7, b8 }) dans ce JSON.");
      return;
    }
    const now = new Date().toISOString();
    for (const r of records) {
      await addImported({ id: uid(), label: r.label, email: r.email || null, responses: r.responses, createdAt: now });
    }
    toast.success(`${records.length} candidat${records.length > 1 ? "s" : ""} importé${records.length > 1 ? "s" : ""}.`);
    refresh();
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    const email = accForm.email.trim();
    if (!isValidEmail(email)) { setAccForm((f) => ({ ...f, error: "Adresse email invalide." })); return; }
    if (accForm.password.length < 4) { setAccForm((f) => ({ ...f, error: "Le mot de passe doit contenir au moins 4 caractères." })); return; }
    setAccForm((f) => ({ ...f, busy: true, error: null }));
    const res = await createCandidateAccount({
      email,
      password: accForm.password,
      responses: selected.responses,
      importedId: selected.kind === "imp" && !selected.data.file ? selected.data.id : null,
    });
    if (res.error) { setAccForm((f) => ({ ...f, error: res.error, busy: false })); return; }
    setCreatedLinks((prev) => ({ ...prev, [selected.id]: email }));
    toast.success(
      res.confirmationRequired
        ? `Compte créé — un email de validation a été envoyé à ${email}. Confirmation requise avant la première connexion.`
        : res.existed
          ? `Un compte existait déjà pour ${email} — l'import a été lié à ce compte.`
          : `Compte créé pour ${email} — le candidat peut se connecter avec les identifiants renseignés.`
    );
    setAccForm({ open: false, email: "", password: "", error: null, busy: false });
    // Miroir local (cache) : affichage immédiat du candidat même si les
    // données en ligne ne sont pas encore visibles (latence fetch/RLS).
    await ensureLocalAccount(email);
    refresh();
  };

  const applyUpdateResults = async (target, text, name) => {
    setUpdateTarget(null);
    if (text == null) { toast.error("Impossible de lire le fichier sélectionné."); return; }
    const records = parseCandidateImport(text, name);
    if (!records || records.length === 0) {
      toast.error("Aucune réponse exploitable ({ mcq, b7, b8 }) dans ce JSON.");
      return;
    }
    const rec = records[0];
    if (target.kind === "supabase") {
      // Source de vérité : Supabase (remplace toutes les réponses de la tentative).
      const attempt = await getOrCreateAttempt(target.data.userId);
      const res = await saveResponses(attempt.id, rec.responses, { replace: true });
      if (!res.ok) {
        toast.error("Échec de l'enregistrement en ligne : " + (res.error?.message || res.error));
        return;
      }
    } else if (target.kind === "acct") {
      const ok = await updateAccountResponses(target.data.email, rec.responses);
      if (!ok) { toast.error("Compte introuvable — réponses non mises à jour."); return; }
    } else if (target.isStatic || (target.kind === "imp" && !target.data.id)) {
      await markStaticHidden(target.file);
      const now = new Date().toISOString();
      await addImported({ id: uid(), label: rec.label || target.label, email: rec.email || null, responses: rec.responses, createdAt: now });
    } else if (target.kind === "imp" && target.data.id) {
      const ok = await saveImportedResponses(target.data.id, rec.responses, rec.label || null);
      if (!ok) { toast.error("Import introuvable — réponses non mises à jour."); return; }
    }
    toast.success(records.length > 1
      ? `${records.length} candidats dans le fichier — seule la première entrée a été appliquée (réponses de « ${target.label} » mises à jour).`
      : `Réponses de « ${target.label} » mises à jour avec succès.`);
    refresh();
  };

  const requestDeleteCandidate = (c) => setDeleteTarget(c);

  const confirmDeleteCandidate = async () => {
    const c = deleteTarget;
    if (!c) return;
    setDeleteBusy(true);
    try {
      if (c.kind === "supabase") {
        const attempt = attemptsByUser[c.data.userId];
        if (attempt) await deleteAttempt(attempt.id);
      } else if (c.kind === "acct") {
        await deleteAccount(c.data.email);
      } else if (c.isStatic || (c.kind === "imp" && !c.data.id)) {
        await markStaticHidden(c.file);
      } else if (c.kind === "imp" && c.data.id) {
        await deleteImported(c.data.id);
      }
      toast.success(`« ${c.label} » a été supprimé.`);
      if (selection?.id === c.id) goBack();
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la suppression.");
    } finally {
      setDeleteBusy(false);
      setDeleteTarget(null);
    }
  };

  // La mise à jour par JSON écrit dans la source de vérité : Supabase pour
  // les comptes plateforme, l'ancien store local pour les comptes legacy.
  const canManageTarget = (c) => (c.kind === "supabase" ? canEditUsers : true);
  const candidateMenuItems = (c) => [
    ...(canManageTarget(c) ? [{ label: "Mettre à jour…", icon: <Pencil size={14} />, onClick: () => setUpdateTarget(c) }] : []),
    { label: "Supprimer", icon: <Trash2 size={14} />, danger: true, onClick: () => requestDeleteCandidate(c) },
  ];
  const detailMenuItems = (c) => [
    { label: "Exporter JSON", icon: <Download size={14} />, onClick: () => exportResponsesJson(c) },
{ label: "Voir les réponses (mode test)", icon: <Database size={14} />, onClick: () => navigate(`/admin/mode-test/${encodeURIComponent(c.id)}`) },
    ...(canManageTarget(c) ? [{ label: "Mettre à jour…", icon: <Pencil size={14} />, onClick: () => setUpdateTarget(c) }] : []),
    { label: "Supprimer", icon: <Trash2 size={14} />, danger: true, onClick: () => requestDeleteCandidate(c) },
  ];

  const acctMeta = selected?.data;
  const hasData = selected && selected.progress.answered > 0;

  const SECTIONS = [
    { key: "axes", label: "Résultats par axe", description: "Scores des 8 axes (Radar)" },
    { key: "jobs", label: "Correspondance aux 5 métiers", description: "Adéquation aux 5 métiers" },
    { key: "strengths", label: "Forces", description: "Points forts identifiés" },
    { key: "vigilance", label: "Points de vigilance", description: "Points de vigilance identifiés" },
    { key: "dimensions", label: "Détail des dimensions", description: "Scores des 44 dimensions" },
    { key: "responses", label: "Réponses détaillées", description: "Réponses aux batteries de tests" },
  ];

  return (
    <AppShell maxWidth={1000} sidebar={<AppSidebar />}>
      {!selected ? (
        <>
          <PageTitle
            title="Candidats"
            subtitle={pageHasCriteria ? `${pageList.length} affiché${pageList.length > 1 ? "s" : ""} (vue filtrée) sur ${candidates.length}` : `${candidates.length} candidat${candidates.length > 1 ? "s" : ""}`}
          />
          <div className="admin-toolbar flex flex-wrap items-center gap-2.5 mb-5">
            <FilterDropdown filters={pageFilters} onFilters={setPageFilters} metiers={METIERS} axes={AXIS_OPTIONS} />
            <SearchField value={pageQuery} onChange={setPageQuery} placeholder="Rechercher par nom ou email…" />
            <div className="admin-toolbar__actions flex items-center gap-2 ml-auto">
              {isSuperAdmin && (
                <Button variant="outline" size="sm" onClick={() => handleNavigate("/super-admin")}>
                  <ArrowLeft size={14} /> Retour à l'espace Super Admin
                </Button>
              )}
              <ViewToggle value={viewMode} onChange={setViewMode} />
              <ImportJsonButton onImport={handleImport}>Importer un JSON</ImportJsonButton>
            </div>
          </div>
          {pageList.length === 0 ? (
            <EmptyState
              className="rounded-xl border border-border bg-card"
              style={{ padding: "40px 30px", lineHeight: 1.7 }}
              title={candidates.length === 0 ? "Aucun candidat" : "Aucun candidat trouvé"}
              description={candidates.length === 0
                ? "Aucun candidat pour le moment. Utilisez « Importer un JSON » pour ajouter des résultats, ou laissez les candidats s'inscrire via /inscription."
                : "Aucun candidat ne correspond à la recherche ou aux filtres actuels."}
            />
          ) : viewMode === "list" ? (
            <div className="flex flex-col gap-2">
              {pageList.map((c) => (
                <div key={c.id} role="button" tabIndex={0} onClick={() => openCandidate(c)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openCandidate(c); }}
                  className="admin-list-row flex w-full cursor-pointer items-center gap-3.5 rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-colors duration-150 hover:border-primary/40">
                  <Avatar kind={c.kind === "supabase" || c.kind === "acct" ? "acct" : "imp"} label={c.label} />
                  <div className="admin-list-row__main min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">{c.label}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{c.meta}</div>
                  </div>
                  <div className="admin-list-row__side ml-auto flex items-center gap-2.5">
                    <Badge tone={c.badgeTone}>{c.badge}</Badge>
                    <ProgressCircle done={c.progress.answered} total={c.progress.total}>
                      <span className="text-[9.5px] text-primary">{c.progress.pct}%</span>
                    </ProgressCircle>
                    <RowMenu items={candidateMenuItems(c)} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
              {pageList.map((c) => (
                <div key={c.id} role="button" tabIndex={0} onClick={() => openCandidate(c)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openCandidate(c); }}
                  className="flex cursor-pointer flex-col gap-2.5 rounded-xl border border-border bg-card p-4 text-left transition-colors duration-150 hover:border-primary/40">
                  <div className="flex items-center justify-between gap-2">
                    <Avatar kind={c.kind === "supabase" || c.kind === "acct" ? "acct" : "imp"} label={c.label} />
                    <div className="flex items-center gap-1.5">
                      <Badge tone={c.badgeTone}>{c.badge}</Badge>
                      <RowMenu items={candidateMenuItems(c)} />
                    </div>
                  </div>
                  <div className="truncate text-sm font-semibold text-foreground">{c.label}</div>
                  <div className="truncate text-xs text-muted-foreground">{c.meta}</div>
                  <div className="mt-0.5 flex items-center gap-2.5">
                    <ProgressCircle done={c.progress.answered} total={c.progress.total}>
                      <span className="text-[9.5px] text-primary">{c.progress.pct}%</span>
                    </ProgressCircle>
                    <span className="text-xs text-muted-foreground">{c.progress.answered}/{c.progress.total} réponses</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <Button variant="ghost" size="sm" onClick={goBack} className="-ml-1 mb-1 gap-1 px-2 text-[13px] text-muted-foreground hover:text-foreground">
            <ChevronLeft size={16} /> Retour à la liste
          </Button>
          <PageTitle
            title={selected.label}
            right={
              <div className="candidate-header-actions flex items-center gap-2">
                <Button size="sm" onClick={openPdfExportModal}>
                  <Printer size={14} /> Exporter PDF
                </Button>

                <RowMenu items={detailMenuItems(selected)} />
              </div>
            }
            subtitle={
              <div className="candidate-header-subtitle flex items-center gap-2">
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
            <div className="mb-4">
              {linkedEmail ? (
                <div className="rounded-[10px] border border-success-border bg-success-soft px-3.5 py-2.5 text-[13px] text-success">
                  <strong>Compte lié :</strong> {linkedEmail} — ce candidat peut se connecter via /connexion.
                </div>
              ) : accForm.open ? (
                <div className="rounded-xl border border-border bg-card px-4.5 py-4">
                  <form onSubmit={handleCreateAccount}>
                    <Field label="Email du compte" type="email" placeholder="candidat@exemple.org" value={accForm.email}
                      onChange={(e) => setAccForm((f) => ({ ...f, email: e.target.value }))} />
                    <PasswordField label="Mot de passe" placeholder="Au moins 4 caractères" value={accForm.password}
                      onChange={(e) => setAccForm((f) => ({ ...f, password: e.target.value }))} />
                    {accForm.error && <div className="mb-2.5 text-[12.5px] text-destructive">{accForm.error}</div>}
                    <div className="flex gap-2.5">
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

          <div className="mb-4.5 flex flex-wrap gap-4 text-[12.5px] text-muted-foreground">
            {selected.kind === "acct" ? (
              <>
                <span className="flex items-center gap-1"><Mail size={13} /> {selected.label}</span>
                <span className="flex items-center gap-1"><Calendar size={13} /> Inscrit le {formatDate(acctMeta.createdAt)}</span>
              </>
            ) : (
              <span><FileJson size={13} className="-mb-0.5 mr-1 inline align-baseline" /> {selected.meta}</span>
            )}
            <span><strong className="text-foreground">{selected.progress.answered}/{selected.progress.total}</strong> réponses enregistrées</span>
          </div>

          {!hasData ? (
            <EmptyState
              className="rounded-xl border border-border bg-card"
              title={selected.kind === "acct" ? "Aucune réponse au test" : "Aucune réponse exploitable"}
              description={selected.kind === "acct"
                ? "Ce compte n'a encore fourni aucune réponse au test."
                : "Ce candidat importé ne contient aucune réponse exploitable au test."}
            />
          ) : (
<ResultsBlock candidate={selected} />
          )}
        </>
      )}
      <Modal open={!!updateTarget} onClose={() => setUpdateTarget(null)} title="Mettre à jour les réponses" maxWidth={440}>
        {updateTarget && (
          <>
            <p className="mb-3.5 mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              Les réponses de <strong className="text-foreground">{updateTarget.label}</strong> seront remplacées par le contenu d'un nouveau fichier JSON.
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <ImportJsonButton onImport={(text, name) => applyUpdateResults(updateTarget, text, name)}>Choisir un fichier JSON…</ImportJsonButton>
              <Button variant="ghost" size="sm" onClick={() => setUpdateTarget(null)}>Annuler</Button>
            </div>
          </>
        )}
      </Modal>
      <Modal
        open={pdfExportModal.open}
        onClose={closePdfExportModal}
        title="Exporter le rapport PDF"
        maxWidth={440}
        ariaLabel="Exporter le rapport PDF"
      >
        <p className="mb-4 text-[13px] text-muted-foreground">Sélectionnez les sections à inclure dans le rapport.</p>
        <div className="mb-4 flex flex-col gap-2.5">
          {SECTIONS.map((section) => (
            <CheckboxField
              key={section.key}
              id={`pdf-section-${section.key}`}
              checked={pdfExportSections[section.key]}
              onCheckedChange={() => setPdfExportSections((prev) => ({ ...prev, [section.key]: !prev[section.key] }))}
              className={cn(
                "items-center rounded-[10px] border border-border p-3.5 transition-colors",
                pdfExportSections[section.key] ? "bg-muted" : "bg-card"
              )}
              labelClassName="text-[13.5px] font-semibold"
              label={section.label}
              description={section.description}
            />
          ))}
        </div>
        {!anySectionSelected && (
          <div className="mb-4 rounded-lg border border-warning-border bg-warning-soft px-3.5 py-2.5 text-[13px] text-warning">
            Sélectionnez au moins une section pour générer le rapport.
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <div className="text-[13px] text-muted-foreground">
            {pdfExportModal.countdown > 0 && `Export automatique dans ${pdfExportModal.countdown} s`}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={closePdfExportModal}>Annuler</Button>
            <Button size="sm" onClick={handlePdfExportOk} disabled={!anySectionSelected}>
              <Check size={14} /> OK
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteCandidate}
        loading={deleteBusy}
        title="Supprimer définitivement"
        description={deleteTarget ? `${deleteTarget.label} sera définitivement supprimé${deleteTarget.kind === "acct" ? " avec son compte et ses réponses" : ""}. Continuer ?` : ""}
        confirmLabel="Supprimer"
        danger
      />
    </AppShell>
  );
}
