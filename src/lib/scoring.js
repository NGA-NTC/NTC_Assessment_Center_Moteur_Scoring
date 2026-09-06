import { DIMS, AXES, ROLES, BATTERIES, WEIGHTED_ITEMS, B1_ITEMS } from "../data/index.js";

/* ============================== SCORING ENGINE ============================== */
function computeRanges() {
  const ranges = {};
  DIMS.forEach((d) => (ranges[d.key] = { min: 0, max: 0 }));
  WEIGHTED_ITEMS.forEach((item) => {
    const dimVals = {};
    Object.values(item.w).forEach((pairs) => {
      pairs.forEach(([dim, val]) => {
        if (!dimVals[dim]) dimVals[dim] = [];
        dimVals[dim].push(val);
      });
    });
    Object.entries(dimVals).forEach(([dim, vals]) => {
      ranges[dim].max += Math.max(...vals, 0);
      ranges[dim].min += Math.min(...vals, 0);
    });
  });
  return ranges;
}
const RANGES = computeRanges();

export function computeDimensionScores(responses) {
  const raw = {}, count = {};
  DIMS.forEach((d) => { raw[d.key] = 0; count[d.key] = 0; });

  B1_ITEMS.forEach((it) => {
    if (it.open) return;
    const sel = responses.mcq[it.id];
    if (!sel) return;
    count[it.dim] += 1;
    if (sel === it.c) raw[it.dim] += 1;
  });

  WEIGHTED_ITEMS.forEach((it) => {
    const sel = responses.mcq[it.id];
    if (!sel || !it.w[sel]) return;
    it.w[sel].forEach(([dim, val]) => { raw[dim] = (raw[dim] || 0) + val; });
  });

  const scores = {};
  DIMS.forEach((d) => {
    if (d.battery === 1) {
      scores[d.key] = count[d.key] > 0 ? Math.round((100 * raw[d.key]) / count[d.key]) : null;
    } else if (d.battery >= 2 && d.battery <= 6) {
      const r = RANGES[d.key];
      scores[d.key] = r.max > r.min ? Math.round((100 * (raw[d.key] - r.min)) / (r.max - r.min)) : null;
    }
  });

  const b7sums = {}, b7counts = {};
  Object.entries(responses.b7 || {}).forEach(([, dimScores]) => {
    Object.entries(dimScores || {}).forEach(([dim, val]) => {
      if (val == null || dim === "text") return;
      b7sums[dim] = (b7sums[dim] || 0) + val;
      b7counts[dim] = (b7counts[dim] || 0) + 1;
    });
  });
  ["NST", "PRO", "PRI", "GCH"].forEach((dim) => {
    if (b7counts[dim] > 0) scores[dim] = Math.round((100 * (b7sums[dim] / b7counts[dim] - 1)) / 3);
  });
  if (b7counts["VS"] > 0) {
    const b7vs = (100 * (b7sums["VS"] / b7counts["VS"] - 1)) / 3;
    scores["VS"] = scores["VS"] != null ? Math.round((scores["VS"] + b7vs) / 2) : Math.round(b7vs);
  }
  return scores;
}

const INTENSITY = { leger: 33, modere: 66, fort: 100 };
export function computeCoherence(declaredScores, b8responses) {
  const simSums = {}, simCounts = {};
  Object.values(b8responses || {}).forEach((dims) => {
    Object.entries(dims || {}).forEach(([dim, label]) => {
      if (dim === "text" || !label || label === "none" || !INTENSITY[label]) return;
      simSums[dim] = (simSums[dim] || 0) + INTENSITY[label];
      simCounts[dim] = (simCounts[dim] || 0) + 1;
    });
  });
  const gaps = [];
  Object.keys(simCounts).forEach((dim) => {
    if (declaredScores[dim] == null) return;
    const simulated = simSums[dim] / simCounts[dim];
    gaps.push(Math.abs(declaredScores[dim] - simulated));
  });
  if (gaps.length === 0) return null;
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return Math.max(0, Math.min(100, Math.round(100 - avgGap)));
}

export function computeAxisScores(dimScores, coherence) {
  const axisScores = {};
  AXES.forEach((ax) => {
    if (ax === "Cohérence") { axisScores[ax] = coherence; return; }
    const dimsInAxis = DIMS.filter((d) => d.axis === ax);
    const vals = dimsInAxis.map((d) => {
      const v = dimScores[d.key];
      if (v == null) return null;
      return d.reverse ? 100 - v : v;
    }).filter((v) => v != null);
    axisScores[ax] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  });
  return axisScores;
}

export function computeRoleFit(dimScores, axisScores) {
  return ROLES.map((role) => {
    let sum = 0, wsum = 0;
    Object.entries(role.w).forEach(([key, weight]) => {
      const val = key === "COHERENCE" ? axisScores["Cohérence"] : dimScores[key];
      if (val == null) return;
      sum += val * weight; wsum += weight;
    });
    return { ...role, fit: wsum > 0 ? Math.round(sum / wsum) : null, covered: wsum, total: Object.values(role.w).reduce((a, b) => a + b, 0) };
  }).sort((a, b) => (b.fit ?? -1) - (a.fit ?? -1));
}

export function generateReport(dimScores) {
  const scored = DIMS.filter((d) => dimScores[d.key] != null).map((d) => ({ ...d, score: d.reverse ? 100 - dimScores[d.key] : dimScores[d.key] }));
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const strengths = sorted.slice(0, 5);
  const watch = [...sorted].reverse().filter((d) => !d.neutral).slice(0, 3);
  return { strengths, watch, answered: scored.length };
}

export function progress(battery, responses) {
  if (battery.type === "correct" || battery.type === "weighted") {
    const answered = battery.items.filter((it) => responses.mcq[it.id]).length;
    return { answered, total: battery.items.length };
  }
  if (battery.type === "rubric") {
    const answered = battery.items.filter((it) => responses.b7[it.id] && Object.entries(responses.b7[it.id]).some(([k, v]) => k !== "text" && v != null)).length;
    return { answered, total: battery.items.length };
  }
  const answered = battery.items.filter((it) => responses.b8[it.id] && Object.entries(responses.b8[it.id]).some(([k, v]) => k !== "text" && v && v !== "none")).length;
  return { answered, total: battery.items.length };
}

export function accountProgress(responses) {
  let answered = 0, total = 0;
  BATTERIES.forEach((b) => { const p = progress(b, responses); answered += p.answered; total += p.total; });
  return { answered, total, pct: total ? Math.round((100 * answered) / total) : 0 };
}

export function emptyResponses() { return { mcq: {}, b7: {}, b8: {} }; }