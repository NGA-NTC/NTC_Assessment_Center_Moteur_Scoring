import { DIM } from "../../data/index.js";
import { LINE } from "../../lib/theme.js";
import QuestionCard from "./QuestionCard.jsx";
import OptionButton from "./OptionButton.jsx";

export default function McqBattery({ battery, responses, setResponses }) {
  return (
    <div>
      {battery.items.map((it) => (
        <QuestionCard key={it.id} id={it.id} dimName={DIM[it.dim]?.name} text={it.text}>
          {it.open ? (
            <textarea
              placeholder="Réponse libre — non notée automatiquement, cf. grille de lecture."
              value={responses.mcq[it.id] || ""}
              onChange={(e) => setResponses((r) => ({ ...r, mcq: { ...r.mcq, [it.id]: e.target.value } }))}
              style={{ width: "100%", minHeight: 70, border: `1px solid ${LINE}`, borderRadius: 8, padding: 10, fontSize: 13.5, fontFamily: "inherit", resize: "vertical" }} />
          ) : (
            ["A", "B", "C", "D"].map((L) => (
              <OptionButton key={L} letter={L} text={it.o[L]} selected={responses.mcq[it.id] === L}
                onClick={() => setResponses((r) => ({ ...r, mcq: { ...r.mcq, [it.id]: L } }))} />
            ))
          )}
        </QuestionCard>
      ))}
    </div>
  );
}