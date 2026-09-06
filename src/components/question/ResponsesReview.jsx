import { B7_RUBRIC, BATTERIES, DIM } from "../../data/index.js";
import { accountProgress } from "../../lib/scoring.js";
import { GOLD, INK, LINE, MUTED, NAVY, SERIF } from "../../lib/theme.js";
import QuestionCard from "./QuestionCard.jsx";
import InfoCallout from "./InfoCallout.jsx";

const B7_DIMS = ["NST", "PRO", "PRI", "GCH", "VS"];
const B8_OPTS = [["none", "Non obs."], ["leger", "Léger"], ["modere", "Modéré"], ["fort", "Fort"]];

function TextBlock({ value, placeholder }) {
  return (
    <div style={{ minHeight: 50, background: "#FAF8F2", border: `1px dashed ${LINE}`, borderRadius: 8, padding: 10, fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap", color: value ? INK : MUTED }}>
      {value || placeholder || "Non renseigné"}
    </div>
  );
}

function ReadonlyOption({ letter, text, selected }) {
  return (
    <div style={{ width: "100%", display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 13px", marginBottom: 6, borderRadius: 8, border: selected ? `1.5px solid ${NAVY}` : `1.5px solid ${LINE}`, background: selected ? NAVY : "#fff", color: selected ? "#fff" : INK, fontSize: 13.5, lineHeight: 1.45 }}>
      <span style={{ fontWeight: 700, fontSize: 12.5, opacity: selected ? 1 : 0.55, flexShrink: 0, marginTop: 1 }}>{letter}</span>
      <span>{text}</span>
    </div>
  );
}

function McqReview({ battery, responses }) {
  return battery.items.map((it) => (
    <QuestionCard key={it.id} id={it.id} dimName={DIM[it.dim]?.name} text={it.text}>
      {it.open ? (
        <TextBlock value={responses.mcq[it.id] || ""} placeholder="Réponse libre non renseignée." />
      ) : (
        <>
          {["A", "B", "C", "D"].map((L) => (
            <ReadonlyOption key={L} letter={L} text={it.o[L]} selected={responses.mcq[it.id] === L} />
          ))}
          {!responses.mcq[it.id] && <div style={{ fontSize: 12, color: MUTED }}>Aucune réponse sélectionnée.</div>}
        </>
      )}
    </QuestionCard>
  ));
}

function B7Review({ battery, responses }) {
  return battery.items.map((it) => {
    const row = responses.b7[it.id] || {};
    const hasScore = B7_DIMS.some((dim) => row[dim] != null);
    return (
      <QuestionCard key={it.id} id={it.id} text={it.text} marginBottom={14}>
        <div style={{ marginBottom: 12 }}>
          <TextBlock value={row.text || ""} placeholder="Réponse écrite non renseignée." />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 12 }}>
          {B7_DIMS.map((dim) => {
            const v = row[dim];
            return (
              <div key={dim} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{DIM[dim].name}</div>
                <div style={{ display: "flex", gap: 5 }}>
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} title={B7_RUBRIC[dim][n - 1]} style={{ flex: 1, padding: "6px 0", borderRadius: 6, fontSize: 12.5, fontWeight: 600, textAlign: "center", border: v === n ? `1.5px solid ${GOLD}` : `1px solid ${LINE}`, background: v === n ? GOLD : "#fff", color: v === n ? NAVY : MUTED }}>{n}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {!hasScore && <div style={{ fontSize: 12, color: MUTED }}>Aucune note attribuée.</div>}
      </QuestionCard>
    );
  });
}

function B8Review({ battery, responses }) {
  return battery.items.map((it) => {
    const row = responses.b8[it.id] || {};
    const hasIntensity = Object.keys(row).some((k) => k !== "text" && row[k] && row[k] !== "none");
    return (
      <QuestionCard key={it.id} id={it.id} text={it.text} marginBottom={14}>
        <div style={{ marginBottom: 12 }}>
          <TextBlock value={row.text || ""} placeholder="Réponse écrite non renseignée." />
        </div>
        <div>
          {it.watch.map((dimKey) => {
            const v = row[dimKey];
            return (
              <div key={dimKey} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 12, width: 150, flexShrink: 0 }}>{DIM[dimKey]?.name}</div>
                <div style={{ display: "flex", gap: 4, flex: 1 }}>
                  {B8_OPTS.map(([k, label]) => (
                    <div key={k} style={{ flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 11, textAlign: "center", border: v === k ? `1.5px solid ${NAVY}` : `1px solid ${LINE}`, background: v === k ? NAVY : "#fff", color: v === k ? "#fff" : MUTED, fontWeight: v === k ? 600 : 400 }}>{label}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {!hasIntensity && <div style={{ fontSize: 12, color: MUTED }}>Aucune intensité observée.</div>}
      </QuestionCard>
    );
  });
}

export default function ResponsesReview({ responses }) {
  const { answered } = accountProgress(responses);

  return (
    <div>
      <InfoCallout>Relecture des réponses telles qu'affichées durant le test (lecture seule).</InfoCallout>
      {answered === 0 && <div style={{ padding: 24, textAlign: "center", color: MUTED, fontSize: 13 }}>Aucune réponse enregistrée.</div>}
      {answered > 0 && BATTERIES.map((b) => (
        <div key={b.id} style={{ marginBottom: 26 }}>
          <div style={{ fontFamily: SERIF, fontSize: 16.5, fontWeight: 600, color: NAVY, marginBottom: 10, display: "flex", gap: 8, alignItems: "baseline" }}>
            Batterie {b.id}
            <span style={{ fontSize: 12, color: MUTED }}>· {b.name}</span>
          </div>
          {b.type === "correct" || b.type === "weighted" ? (
            <McqReview battery={b} responses={responses} />
          ) : b.type === "rubric" ? (
            <B7Review battery={b} responses={responses} />
          ) : (
            <B8Review battery={b} responses={responses} />
          )}
        </div>
      ))}
    </div>
  );
}