import { useMemo } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";
import { Sparkles, AlertTriangle } from "lucide-react";
import { AXES } from "../data/index.js";
import { computeDimensionScores, computeCoherence, computeAxisScores, computeRoleFit, generateReport } from "../lib/scoring.js";

const NAVY = "#1B2A4A", GOLD = "#B8862B", GOLD2 = "#D9A94A", LINE = "#E4DFD0";

function RoleBar({ role }) {
  const coverageRatio = role.total ? role.covered / role.total : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{role.name}</span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: NAVY }}>{role.fit != null ? role.fit + "%" : "—"}</span>
      </div>
      <div style={{ height: 10, background: "#EDE9DC", borderRadius: 5, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${role.fit || 0}%`, background: `linear-gradient(90deg, ${GOLD}, ${GOLD2})`, borderRadius: 5, transition: "width .4s" }} />
      </div>
      {coverageRatio > 0 && coverageRatio < 0.6 && <div style={{ fontSize: 10.5, color: "#8A8578", marginTop: 3 }}>Données partielles ({Math.round(coverageRatio * 100)}% des dimensions du modèle couvertes)</div>}
    </div>
  );
}

export default function ResultsView({ responses }) {
  const dimScores = useMemo(() => computeDimensionScores(responses), [responses]);
  const coherence = useMemo(() => computeCoherence(dimScores, responses.b8), [dimScores, responses.b8]);
  const axisScores = useMemo(() => computeAxisScores(dimScores, coherence), [dimScores, coherence]);
  const roleFit = useMemo(() => computeRoleFit(dimScores, axisScores), [dimScores, axisScores]);
  const report = useMemo(() => generateReport(dimScores), [dimScores]);

  const radarData = AXES.map((ax) => ({ axis: ax, score: axisScores[ax] ?? 0 }));
  const anyData = report.answered > 0;
  const MUTED = "#8A8578";

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: "18px 10px" }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 16, fontWeight: 600, padding: "0 14px 10px", color: NAVY }}>Radar — 8 axes</div>
          {anyData ? (
            <ResponsiveContainer width="100%" height={340}>
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke={LINE} />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "#2A2A28" }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Profil" dataKey="score" stroke={NAVY} fill={NAVY} fillOpacity={0.32} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: MUTED, fontSize: 13 }}>Aucune réponse enregistrée pour l'instant.</div>
          )}
        </div>
        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: "18px 18px" }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 16, fontWeight: 600, marginBottom: 12, color: NAVY }}>Correspondance aux 5 métiers</div>
          {roleFit.map((r) => <RoleBar key={r.key} role={r} />)}
          <div style={{ fontSize: 10.5, color: MUTED, marginTop: 4 }}>Modèle de pondération raisonné — indicatif, non statistiquement validé.</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Sparkles size={16} color={GOLD} />
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 15.5, fontWeight: 600, color: NAVY }}>Forces</div>
          </div>
          {report.strengths.length === 0 && <div style={{ fontSize: 12.5, color: MUTED }}>Pas encore de données.</div>}
          {report.strengths.map((d) => (
            <div key={d.key} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${LINE}` }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{d.name}</span>
                <span style={{ fontSize: 12.5, color: GOLD, fontWeight: 700 }}>{d.score}</span>
              </div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{d.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <AlertTriangle size={16} color="#B5652E" />
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 15.5, fontWeight: 600, color: NAVY }}>Points de vigilance</div>
          </div>
          {report.watch.length === 0 && <div style={{ fontSize: 12.5, color: MUTED }}>Pas encore de données.</div>}
          {report.watch.map((d) => (
            <div key={d.key} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${LINE}` }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{d.name}</span>
                <span style={{ fontSize: 12.5, color: "#B5652E", fontWeight: 700 }}>{d.score}</span>
              </div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{d.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {coherence != null && (
        <div style={{ background: NAVY, borderRadius: 14, padding: "18px 20px", marginTop: 20, color: "#fff" }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 15.5, fontWeight: 600, marginBottom: 6, color: GOLD2 }}>Cohérence comportementale — {coherence}%</div>
          <div style={{ fontSize: 12.5, color: "#D7DCE8", lineHeight: 1.6 }}>
            {coherence >= 75 ? "Écart faible et généralisé entre ce que la personne dit d'elle-même et ce qu'elle fait en simulation intégrée — bonne cohérence discours/action." :
              coherence >= 50 ? "Écart modéré sur certaines dimensions. Zone à explorer en entretien de développement — pas une alerte disqualifiante en soi." :
                "Écart généralisé et important entre profil déclaré et comportement simulé. À traiter avec prudence, en entretien individuel plutôt qu'en conclusion automatique."}
          </div>
        </div>
      )}
    </div>
  );
}