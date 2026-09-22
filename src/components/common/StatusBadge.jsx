import Badge from "../ui/Badge.jsx";

const DEFAULT_TONES = {
  active: "success",
  inactive: "neutral",
  suspended: "warning",
  pending: "warning",
  imported: "import",
  account: "compte",
  implemented: "success",
  declared: "muted",
  enabled: "success",
  disabled: "muted",
};

export default function StatusBadge({ status, labels = {}, tones = DEFAULT_TONES, fallback = "—" }) {
  const tone = tones[status] ?? "neutral";
  const label = labels[status] ?? status?.replace(/_/g, " ") ?? fallback;
  return <Badge tone={tone}>{label}</Badge>;
}