import { LINE } from "../../lib/theme.js";
import QuestionCard from "./QuestionCard.jsx";
import RubricScorer from "./RubricScorer.jsx";
import InfoCallout from "./InfoCallout.jsx";

const DIMS = ["NST", "PRO", "PRI", "GCH", "VS"];

export default function RubricBattery({ battery, responses, setResponses }) {
  return (
    <div>
      <InfoCallout>
        Notez chaque cas sur les 5 dimensions (1 = faible, 4 = elite) après lecture de la réponse écrite du candidat. Survolez un chiffre pour voir l'ancrage comportemental.
      </InfoCallout>
      {battery.items.map((it) => (
        <QuestionCard key={it.id} id={it.id} text={it.text} marginBottom={14}>
          <textarea
            placeholder="Réponse écrite du candidat…"
            value={responses.b7[it.id]?.text || ""}
            onChange={(e) => setResponses((r) => ({ ...r, b7: { ...r.b7, [it.id]: { ...r.b7[it.id], text: e.target.value } } }))}
            style={{ width: "100%", minHeight: 80, border: `1px solid ${LINE}`, borderRadius: 8, padding: 10, fontSize: 13.5, fontFamily: "inherit", marginBottom: 14, resize: "vertical" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 12 }}>
            {DIMS.map((dim) => (
              <RubricScorer key={dim} dim={dim} value={responses.b7[it.id]?.[dim]}
                onChange={(n) => setResponses((r) => ({ ...r, b7: { ...r.b7, [it.id]: { ...r.b7[it.id], [dim]: n } } }))} />
            ))}
          </div>
        </QuestionCard>
      ))}
    </div>
  );
}