import { LINE } from "../../lib/theme.js";
import QuestionCard from "./QuestionCard.jsx";
import IntensityToggle from "./IntensityToggle.jsx";
import InfoCallout from "./InfoCallout.jsx";

export default function CoherenceBattery({ battery, responses, setResponses }) {
  return (
    <div>
      <InfoCallout>
        Cette batterie ne mesure aucune dimension nouvelle. Pour chaque simulation, notez l'intensité <em>observée</em> dans la réponse du candidat sur les dimensions listées — l'écart avec le profil déclaré (Batteries 1-7) produit l'axe Cohérence comportementale.
      </InfoCallout>
      {battery.items.map((it) => (
        <QuestionCard key={it.id} id={it.id} text={it.text} marginBottom={14}>
          <textarea
            placeholder="Réponse écrite du candidat…"
            value={responses.b8[it.id]?.text || ""}
            onChange={(e) => setResponses((r) => ({ ...r, b8: { ...r.b8, [it.id]: { ...r.b8[it.id], text: e.target.value } } }))}
            style={{ width: "100%", minHeight: 80, border: `1px solid ${LINE}`, borderRadius: 8, padding: 10, fontSize: 13.5, fontFamily: "inherit", marginBottom: 14, resize: "vertical" }} />
          <div>
            {it.watch.map((dimKey) => (
              <IntensityToggle key={dimKey} dimKey={dimKey} value={responses.b8[it.id]?.[dimKey]}
                onChange={(v) => setResponses((r) => ({ ...r, b8: { ...r.b8, [it.id]: { ...r.b8[it.id], [dimKey]: v } } }))} />
            ))}
          </div>
        </QuestionCard>
      ))}
    </div>
  );
}