import { cn } from "@/lib/utils";

export default function ProgressCircle({ done, total, size = 34, color = "var(--primary)", children }) {
  const pct = total ? done / total : 0;
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const complete = pct >= 1;
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size, borderRadius: "50%" }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" className="stroke-line" strokeWidth="3" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          className={cn(complete && "stroke-gold")}
          strokeWidth="3"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={`${circumference * (1 - pct)}`}
          strokeLinecap="round"
          style={complete ? { transition: "stroke-dashoffset 0.3s" } : { stroke: color, transition: "stroke-dashoffset 0.3s" }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children && (
        <div
          className="absolute top-0 left-0 flex items-center justify-center"
          style={{ width: size, height: size }}
        >
          {children}
        </div>
      )}
    </div>
  );
}