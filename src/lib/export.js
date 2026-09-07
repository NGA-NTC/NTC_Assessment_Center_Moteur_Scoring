import { AXES, BATTERIES, DIMS, DIM } from "../data/index.js";
import {
  accountProgress,
  computeAxisScores,
  computeCoherence,
  computeDimensionScores,
  computeRoleFit,
  generateReport,
} from "./scoring.js";

const INTENSITY_FR = { leger: "Léger", modere: "Modéré", fort: "Fort", none: "Non observé" };

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function slug(s) {
  const base = String(s || "candidat").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "candidat";
}

export function exportResponsesJson(candidate) {
  const payload = {
    schemaVersion: "1.0",
    candidate: candidate.label || "",
    exportedAt: new Date().toISOString(),
    progress: accountProgress(candidate.responses),
    responses: candidate.responses,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(candidate.label)}-reponses.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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

export function printCandidateReport(candidate) {
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

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>Rapport — ${esc(candidate.label)}</title>
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
  </div>

  <h2>Résultats par axe</h2>
  <table><tr><th>Axe</th><th>Score</th></tr>${axisRows}</table>
  ${coherence != null ? `<div class="box"><strong>Cohérence comportementale : ${coherence} %</strong> — écart entre le profil déclaré et le comportement observé en simulation intégrée.</div>` : ""}

  <h2>Correspondance aux 5 métiers</h2>
  <table><tr><th>Métier</th><th>Adéquation</th></tr>${roleRows}</table>
  <div class="meta">Modèle de pondération raisonné — indicatif, non statistiquement validé.</div>

  <div class="cols">
    <div>
      <h2>Forces</h2>
      <ul>${report.strengths.map((d) => `<li><strong>${esc(d.name)}</strong> — ${d.score}</li>`).join("")}</ul>
    </div>
    <div>
      <h2>Points de vigilance</h2>
      <ul>${report.watch.map((d) => `<li><strong>${esc(d.name)}</strong> — ${d.score}</li>`).join("")}</ul>
    </div>
  </div>

  <h2>Détail des dimensions (44)</h2>
  <table><tr><th>Dimension</th><th>Axe</th><th>Score</th></tr>${dimRows}</table>

  <h2>Réponses détaillées</h2>
  ${responsesHtml(responses)}
</body></html>`;

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
}