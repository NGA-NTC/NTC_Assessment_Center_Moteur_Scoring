import { useMemo } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { Sparkles, AlertTriangle } from "lucide-react";
import { AXES } from "../data/index.js";
import { computeDimensionScores, computeCoherence, computeAxisScores, computeRoleFit, generateReport } from "../lib/scoring.js";
import { ChartContainer } from "../components/ui/primitives/chart.jsx";
import { Progress } from "../components/ui/primitives/progress.jsx";
import useMediaQuery from "../hooks/ui/useMediaQuery.js";

const NAVY = "var(--primary)";
const GOLD = "var(--secondary)";
const GOLD2 = "var(--accent)";
const LINE = "var(--border)";
const MUTED = "var(--muted-foreground)";
const FOREGROUND = "var(--foreground)";
const SURFACE = "var(--card)";

const SHORT_AXIS = {
  "Cognitif": "Cognitif",
  "Valeurs": "Valeurs",
  "Décision": "Décision",
  "Leadership": "Leader.",
  "Social": "Social",
  "Résilience": "Résil.",
  "Stratégie": "Stratégie",
  "Cohérence": "Cohérente",
};

const RADAR_CONFIG = {
  score: { label: "Score", color: "var(--primary)" },
};

function RoleBar({ role }) {
  const coverageRatio = role.total ? role.covered / role.total : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{role.name}</span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: NAVY }}>{role.fit != null ? role.fit + "%" : "—"}</span>
      </div>
      <Progress
        value={role.fit || 0}
        className="h-2.5 bg-muted"
        indicatorClassName="rounded-full bg-primary"
      />
      {coverageRatio > 0 && coverageRatio < 0.6 && (
        <div style={{ fontSize: 10.5, color: MUTED, marginTop: 3 }}>
          Données partielles ({Math.round(coverageRatio * 100)}% des dimensions du modèle couvertes)
        </div>
      )}
    </div>
  );
}

export default function ResultsView({ responses }) {
  const dimScores = useMemo(() => computeDimensionScores(responses), [responses]);
  const coherence = useMemo(() => computeCoherence(dimScores, responses.b8), [dimScores, responses.b8]);
  const axisScores = useMemo(() => computeAxisScores(dimScores, coherence), [dimScores, coherence]);
  const roleFit = useMemo(() => computeRoleFit(dimScores, axisScores), [dimScores, axisScores]);
  const report = useMemo(() => generateReport(dimScores), [dimScores]);

  // Petit viewport : libère de la place pour les labels d'axes (lisibilité mobile).
  const isSmallViewport = useMediaQuery("(max-width: 400px)");
  const radarOuterRadius = isSmallViewport ? "80%" : "66%";
  const radarTickFontSize = isSmallViewport ? 10.5 : 9.5;

  const radarData = AXES.map((ax) => ({ axis: SHORT_AXIS[ax] || ax, full: ax, score: axisScores[ax] ?? 0 }));
  const anyData = report.answered > 0;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 20 }}>
        <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, padding: "18px 10px", minWidth: 0 }}>
          <div style={{ fontFamily: "var(--ntc-font-serif)", fontSize: 16, fontWeight: 600, padding: "0 14px 10px", color: NAVY }}>Radar — 8 axes</div>
          {anyData ? (
            <>
              <ChartContainer config={RADAR_CONFIG} className="h-[300px] w-full aspect-auto">
                <RadarChart data={radarData} outerRadius={radarOuterRadius}>
                  <PolarGrid stroke={LINE} />
                  <PolarAngleAxis dataKey="axis" tick={{ fontSize: radarTickFontSize, fill: FOREGROUND }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Profil" dataKey="score" stroke={NAVY} fill={NAVY} fillOpacity={0.32} strokeWidth={2} />
                </RadarChart>
              </ChartContainer>
              <div style={{ padding: "2px 12px 6px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "3px 14px", fontSize: 11, color: MUTED }}>
                  {radarData.map((d) => (
                    <div key={d.full} style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{d.full}</span>
                      <span style={{ fontWeight: 700, color: NAVY, flexShrink: 0 }}>{d.score != null ? d.score : "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: MUTED, fontSize: 13 }}>Aucune réponse enregistrée pour l'instant.</div>
          )}
        </div>
        <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, padding: "18px 18px" }}>
          <div style={{ fontFamily: "var(--ntc-font-serif)", fontSize: 16, fontWeight: 600, marginBottom: 12, color: NAVY }}>Correspondance aux 5 métiers</div>
          {roleFit.map((r) => <RoleBar key={r.key} role={r} />)}
          <div style={{ fontSize: 10.5, color: MUTED, marginTop: 4 }}>Modèle de pondération raisonné — indicatif, non statistiquement validé.</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, padding: "18px 20px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Sparkles size={16} color={GOLD} />
            <div style={{ fontFamily: "var(--ntc-font-serif)", fontSize: 15.5, fontWeight: 600, color: NAVY }}>Forces</div>
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
        <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, padding: "18px 20px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <AlertTriangle size={16} color="var(--warning)" />
            <div style={{ fontFamily: "var(--ntc-font-serif)", fontSize: 15.5, fontWeight: 600, color: NAVY }}>Points de vigilance</div>
          </div>
          {report.watch.length === 0 && <div style={{ fontSize: 12.5, color: MUTED }}>Pas encore de données.</div>}
          {report.watch.map((d) => (
            <div key={d.key} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${LINE}` }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{d.name}</span>
                <span style={{ fontSize: 12.5, color: "var(--warning)", fontWeight: 700 }}>{d.score}</span>
              </div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{d.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {coherence != null && (
        <div style={{ background: NAVY, borderRadius: 14, padding: "18px 20px", marginTop: 20, color: "var(--primary-foreground)" }}>
          <div style={{ fontFamily: "var(--ntc-font-serif)", fontSize: 15.5, fontWeight: 600, marginBottom: 6, color: GOLD2 }}>Cohérence comportementale — {coherence}%</div>
          <div style={{ fontSize: 12.5, color: "var(--primary-foreground)", lineHeight: 1.6, opacity: 0.9 }}>
            {coherence >= 75 ? "Écart faible et généralisé entre ce que la personne dit d'elle-même et ce qu'elle fait en simulation intégrée — bonne cohérence discours/action." :
              coherence >= 50 ? "Écart modéré sur certaines dimensions. Zone à explorer en entretien de développement — pas une alerte disqualifiante en soi." :
                "Écart généralisé et important entre profil déclaré et comportement simulé. À traiter avec prudence, en entretien individuel plutôt qu'en conclusion automatique."}
          </div>
        </div>
      )}
    </div>
  );
}
