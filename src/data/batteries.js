import { B1_ITEMS } from "./battery1.js";
import { B2_ITEMS } from "./battery2.js";
import { B3_ITEMS } from "./battery3.js";
import { B4_ITEMS } from "./battery4.js";
import { B5_ITEMS } from "./battery5.js";
import { B6_ITEMS } from "./battery6.js";
import { B7_CASES } from "./battery7.js";
import { B8_SIMS } from "./battery8.js";

export const BATTERIES = [
  { id: 1, name: "Profil cognitif", type: "correct", items: B1_ITEMS, axis: "Cognitif" },
  { id: 2, name: "Valeurs profondes", type: "weighted", items: B2_ITEMS, axis: "Valeurs" },
  { id: 3, name: "Style de décision", type: "weighted", items: B3_ITEMS, axis: "Décision" },
  { id: 4, name: "Leadership naturel", type: "weighted", items: B4_ITEMS, axis: "Leadership" },
  { id: 5, name: "Intelligence sociale", type: "weighted", items: B5_ITEMS, axis: "Social" },
  { id: 6, name: "Stress et pression", type: "weighted", items: B6_ITEMS, axis: "Résilience" },
  { id: 7, name: "Vision stratégique", type: "rubric", items: B7_CASES, axis: "Stratégie" },
  { id: 8, name: "Simulations intégrées", type: "coherence", items: B8_SIMS, axis: "Cohérence" },
];

export const WEIGHTED_ITEMS = [...B2_ITEMS, ...B3_ITEMS, ...B4_ITEMS, ...B5_ITEMS, ...B6_ITEMS];
