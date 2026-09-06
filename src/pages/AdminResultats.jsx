import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, ChevronLeft, Database, FileJson, LayoutGrid, List, Mail, UserPlus } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  createAccount,
  isValidEmail,
  listAccounts,
  listImported,
  addImported,
  linkImportedToAccount,
  parseCandidateImport,
} from "../lib/storage.js";
import { listImportedResults } from "../lib/imported.js";
import { accountProgress } from "../lib/scoring.js";
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
import Badge from "../components/ui/Badge.jsx";
import ProgressCircle from "../components/ui/ProgressCircle.jsx";
import ResponsesReview from "../components/question/ResponsesReview.jsx";
import ResultsView from "./ResultsView.jsx";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

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
    <div style={{ display: "inline-flex", border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden", background: "#fff" }}>
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
    return true;
  });
}

function ResultsBlock({ candidate, view, setView }) {
  return (
    <>
      <ResultsView responses={candidate.responses} />
      <div style={{ marginTop: 16 }}>
        <Button variant="ghost" size="sm" onClick={() => setView(view === "responses" ? "results" : "responses")}>
          <Database size={14} /> {view === "responses" ? "Voir les résultats" : "Voir les réponses (mode test)"}
        </Button>
        {view === "responses" && (
          <div style={{ marginTop: 14, borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
            <ResponsesReview responses={candidate.responses} />
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminResultats() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [staticImports, setStaticImports] = useState([]);
  const [runtimeImports, setRuntimeImports] = useState([]);
  const [sidebarQuery, setSidebarQuery] = useState("");
  const [sidebarFilters, setSidebarFilters] = useState({ type: "all", progress: "all" });
  const [pageQuery, setPageQuery] = useState("");
  const [pageFilters, setPageFilters] = useState({ type: "all", progress: "all" });
  const [viewMode, setViewMode] = useState("list");
  const [selection, setSelection] = useState(null);
  const [view, setView] = useState("results");
  const [createdLinks, setCreatedLinks] = useState({});
  const [importMsg, setImportMsg] = useState(null);
  const [accForm, setAccForm] = useState({ open: false, email: "", password: "", error: null, busy: false });

  useEffect(() => {
    listAccounts().then(setAccounts);
    listImportedResults().then(setStaticImports);
    listImported().then(setRuntimeImports);
  }, []);

  const refresh = () => {
    listAccounts().then(setAccounts);
    listImportedResults().then(setStaticImports);
    listImported().then(setRuntimeImports);
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  const candidates = [
    ...accounts.map((a) => ({
      kind: "acct",
      id: "acct:" + a.email,
      label: a.email,
      badge: "Compte",
      badgeTone: "compte",
      meta: `Inscrit le ${formatDate(a.createdAt)}`,
      responses: a.responses,
      progress: accountProgress(a.responses),
      search: `${a.email} ${a.email}`,
      data: a,
    })),
    ...staticImports.map((f) => ({
      kind: "imp",
      id: "imp:static:" + f.file,
      label: f.name,
      badge: "Importé",
      badgeTone: "import",
      meta: `Fichier ${f.file}`,
      responses: f.responses,
      progress: accountProgress(f.responses),
      search: `${f.name} ${f.file}`,
      data: f,
    })),
    ...runtimeImports.map((im) => ({
      kind: "imp",
      id: "imp:" + im.id,
      label: im.label,
      badge: "Importé",
      badgeTone: "import",
      meta: im.email || `Importé le ${formatDate(im.importedAt || im.createdAt)}`,
      responses: im.responses,
      progress: accountProgress(im.responses),
      search: `${im.label} ${im.email || ""}`,
      data: im,
      linked: im.accountEmail || null,
    })),
  ];

  const sidebarList = filterList(candidates, sidebarQuery, sidebarFilters);
  const pageList = filterList(candidates, pageQuery, pageFilters);
  const pageHasCriteria = Boolean(pageQuery.trim() || pageFilters.type !== "all" || pageFilters.progress !== "all");
  const selected = selection ? candidates.find((c) => c.id === selection.id) || null : null;
  const linkedEmail = selected ? selected.linked || createdLinks[selected.id] || null : null;

  const openCandidate = (c) => {
    setSelection({ id: c.id });
    setView("results");
    setAccForm({ open: false, email: "", password: "", error: null, busy: false });
  };
  const goBack = () => { setSelection(null); setView("results"); setImportMsg(null); };

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

  const acctMeta = selected?.data;
  const hasData = selected && selected.progress.answered > 0;

  return (
    <AppShell maxWidth={1000} sidebar={
      <AdminSidebar
        candidates={sidebarList}
        onSelect={openCandidate}
        selectedId={selection?.id || null}
        onLogout={handleLogout}
        query={sidebarQuery}
        onQueryChange={setSidebarQuery}
        filters={sidebarFilters}
        onFilters={setSidebarFilters}
      />
    }>
      {!selected ? (
        <>
          <PageTitle
            title="Candidats"
            subtitle={pageHasCriteria ? `${pageList.length} affiché${pageList.length > 1 ? "s" : ""} (vue filtrée) sur ${candidates.length}` : `${candidates.length} candidat${candidates.length > 1 ? "s" : ""}`}
          />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: importMsg ? 10 : 20 }}>
            <FilterDropdown filters={pageFilters} onFilters={setPageFilters} />
            <SearchField value={pageQuery} onChange={setPageQuery} placeholder="Rechercher par nom ou email…" />
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
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
                <button key={c.id} onClick={() => openCandidate(c)}
                  style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${LINE}`, background: "#fff", cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "border-color .15s, box-shadow .15s" }}>
                  <Avatar kind={c.kind} label={c.label} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{c.meta}</div>
                  </div>
                  <Badge tone={c.badgeTone}>{c.badge}</Badge>
                  <ProgressCircle done={c.progress.answered} total={c.progress.total} color={NAVY}>
                    <span style={{ fontSize: 9.5, color: NAVY }}>{c.progress.pct}%</span>
                  </ProgressCircle>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 }}>
              {pageList.map((c) => (
                <button key={c.id} onClick={() => openCandidate(c)}
                  style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, borderRadius: 12, border: `1px solid ${LINE}`, background: "#fff", cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "border-color .15s, box-shadow .15s" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <Avatar kind={c.kind} label={c.label} />
                    <Badge tone={c.badgeTone}>{c.badge}</Badge>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</div>
                  <div style={{ fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.meta}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
                    <ProgressCircle done={c.progress.answered} total={c.progress.total} color={NAVY}>
                      <span style={{ fontSize: 9.5, color: NAVY }}>{c.progress.pct}%</span>
                    </ProgressCircle>
                    <span style={{ fontSize: 12, color: MUTED }}>{c.progress.answered}/{c.progress.total} réponses</span>
                  </div>
                </button>
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
            right={<Badge tone={selected.badgeTone}>{selected.badge}</Badge>}
            subtitle={selected.kind === "acct"
              ? `Inscrit le ${formatDate(acctMeta.createdAt)} · Dernière activité ${formatDate(acctMeta.updatedAt)}`
              : (selected.data.file ? `Fichier ${selected.data.file}` : selected.meta)}
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

          {!hasData ? (
            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 30, textAlign: "center", color: MUTED, fontSize: 13.5 }}>
              {selected.kind === "acct" ? "Ce compte n'a encore fourni aucune réponse au test." : "Ce candidat importé ne contient aucune réponse exploitable au test."}
            </div>
          ) : (
            <ResultsBlock candidate={selected} view={view} setView={setView} />
          )}
        </>
      )}
    </AppShell>
  );
}