// ---------------------------------------------------------------------------
// NTC Assessment — Design Tokens (source unique)
// ---------------------------------------------------------------------------
// Identité visuelle conservée telle quelle (ne PAS modifier les valeurs).
// Miroir CSS : src/styles/tokens.css
// Les primitives UI (src/components/ui) consomment ces tokens : aucune valeur
// de style ne doit être dispersée directement dans les pages.

// ---- Palette fondatrice ----------------------------------------------------
export const NAVY = "#1B2A4A";
export const GOLD = "#B8862B";
export const GOLD2 = "#D9A94A";
export const CREAM = "#F7F4EC";
export const INK = "#2A2A28";
export const MUTED = "#8A8578";
export const LINE = "#E4DFD0";

// ---- Typographie réelle (IBM Plex Sans est la police chargée et affichée) --
export const SANS = "'IBM Plex Sans', system-ui, sans-serif";
export const SERIF = "'Fraunces', serif";

// ---- Couleurs -------------------------------------------------------------
export const colors = {
  // Rôles CSS
  background: CREAM,
  foreground: INK,
  mutedForeground: MUTED,
  border: LINE,
  surface: "#FFFFFF",

  // Identité
  navy: NAVY,
  gold: GOLD,
  gold2: GOLD2,
  cream: CREAM,
  ink: INK,
  muted: MUTED,
  line: LINE,

  // Sidebar navy (texte secondaire sur fond navy)
  navyPale: "#B8C0D4",
  navyPale2: "#9AA6C0",
  navySoft: "#E7EDF7",
  navySoftBorder: "#D7DCE8",

  // Sémantique succès
  success: "#2E6B3C",
  successSoft: "#E3F0E4",
  successBorder: "#BFE0C4",

  // Sémantique warning
  warning: "#B5652E",
  warningSoft: "#FEF3E2",
  warningSoftAlt: "#FEF3C7",
  warningStrong: "#92400E",
  warningBorder: "#F5EBD6",
  warningDeep: "#7A5A15",

  // Sémantique destructive
  destructive: "#8A2B22",
  destructiveSoft: "#FAE8E6",
  destructiveBorder: "#F5C6C3",
  destructiveStrong: "#B3261E",

  // Sémantique info / cartes de module
  info: "#1A3D5C",
  info2: "#1A5C3D",
  info3: "#5C3A1A",
  info4: "#3D1A5C",
  info5: "#5C1A3D",

  // Système / neutres
  systemSoft: "#EDE9DC",
  neutralSoft: "#F0EEE6",
  neutralSoft2: "#F3F4F6",
  neutralSoft3: "#F0F0F0",
  neutralText: "#374151",
  neutralTextSoft: "#6B7280",
  nearlyBlack: "#FDFCF9",
  lightWarm: "#F6F5F1",
  lineSoft: "#F4F1E8",
  scrollThumb: "#C9C2AC",
  white: "#FFFFFF",
  transparent: "transparent",
};

// ---- Typographie ----------------------------------------------------------
export const type = {
  fontFamily: {
    sans: SANS,
    serif: SERIF,
  },
  fontSize: {
    xs: 11,
    sm: 12,
    smMd: 12.5,
    base: 13,
    baseMd: 13.5,
    md: 14,
    lg: 15,
    xl: 16,
    xlMd: 16.5,
    brand: 19,
    h3: 18,
    h2: 20,
    h1: 24,
    stat: 28,
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  size: {
    label: 12,
    caption: 12.5,
    body: 14,
  },
};

// ---- Espacements ----------------------------------------------------------
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
};

// ---- Rayons ---------------------------------------------------------------
export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  pill: 20,
  full: 999,
  circle: "50%",
};

// ---- Ombres ---------------------------------------------------------------
export const shadows = {
  card: "0 8px 30px rgba(27,42,74,0.08)",
  menu: "0 6px 24px rgba(27,42,74,0.12)",
  dropdown: "0 10px 30px rgba(0,0,0,0.20)",
  modal: "0 20px 60px rgba(0,0,0,0.25)",
  drawer: "0 14px 36px rgba(0,0,0,0.35)",
};

// ---- Contrôles ------------------------------------------------------------
export const controls = {
  heightSm: 36,
  height: 44,
  heightLg: 50,
  spaceY: space[4],
  gap: 8,
};

// ---- Conteneurs / breakpoints --------------------------------------------
export const container = {
  sm: 720,
  md: 900,
  lg: 1000,
  max: "100%",
};

export const breakpoints = {
  lg: 1024,
  md: 768,
  sm: 480,
};

// ---- Calques --------------------------------------------------------------
export const z = {
  sticky: 10,
  topbar: 20,
  dropdown: 30,
  menu: 50,
  overlay: 99,
  modal: 100,
  backdrop: 120,
  drawer: 130,
};

// ---- Surfaces d'overlay ---------------------------------------------------
export const overlays = {
  modal: "rgba(20,26,40,0.45)",
  backdrop: "rgba(13,20,36,0.5)",
  sidebarDivider: "rgba(255,255,255,0.12)",
  sidebarItem: "rgba(255,255,255,0.14)",
  sidebarHover: "rgba(255,255,255,0.08)",
  sidebarOutline: "rgba(255,255,255,0.22)",
  sidebarWhiteSoft: "rgba(255,255,255,0.15)",
  white07: "rgba(255,255,255,0.7)",
  white05: "rgba(255,255,255,0.05)",
};

// ---- Exports groupé (consommation programmatique) -------------------------
export const tokens = {
  colors,
  type,
  space,
  radius,
  shadows,
  controls,
  container,
  breakpoints,
  z,
  overlays,
};

export default {
  NAVY,
  GOLD,
  GOLD2,
  CREAM,
  INK,
  MUTED,
  LINE,
  SANS,
  SERIF,
  colors,
  type,
  space,
  radius,
  shadows,
  controls,
  container,
  breakpoints,
  z,
  overlays,
  tokens,
};