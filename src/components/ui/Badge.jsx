import { colors, radius, type } from "../../lib/theme.js";

const tones = {
  neutral: { background: colors.neutralSoft, color: colors.muted },
  compte: { background: colors.navySoft, color: colors.navy },
  import: { background: colors.warningBorder, color: colors.warningDeep },
  success: { background: colors.successSoft, color: colors.success },
  warning: { background: colors.warningSoft, color: colors.warning },
  warn: { background: colors.warningSoftAlt, color: colors.warningStrong },
  danger: { background: colors.destructiveSoft, color: colors.destructive },
  error: { background: colors.destructiveSoft, color: colors.destructive },
  info: { background: colors.navySoft, color: colors.info },
  system: { background: colors.systemSoft, color: colors.warningDeep },
  muted: { background: colors.neutralSoft3, color: colors.ink },
};

export default function Badge({ children, tone = "neutral", style }) {
  const t = tones[tone] || tones.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: radius.full,
        fontSize: type.fontSize.xs,
        fontWeight: type.fontWeight.semibold,
        background: t.background,
        color: t.color,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}