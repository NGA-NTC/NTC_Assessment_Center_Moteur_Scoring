import { NAVY, GOLD, LINE } from "../../lib/theme.js";

export default function ProgressCircle({ done, total, size = 34, color = NAVY, children }) {
  const pct = total ? done / total : 0;
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const complete = pct >= 1;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", position: "relative", flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={LINE} strokeWidth="3" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={complete ? GOLD : color} strokeWidth="3"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={`${circumference * (1 - pct)}`}
          strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset .3s" }}
        />
      </svg>
      {children && (
        <div style={{ position: "absolute", top: 0, left: 0, width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {children}
        </div>
      )}
    </div>
  );
}