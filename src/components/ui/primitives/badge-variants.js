import { cva } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1 rounded-full border px-2.5 py-[3px] text-[11px] font-semibold w-fit whitespace-nowrap transition-colors [&>svg]:pointer-events-none [&>svg]:size-3.5 [&>svg]:shrink-0 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-white",
        outline: "text-foreground",
        // Tones NTC (miroir de l'existant : Badge.jsx)
        neutral: "border-transparent bg-muted text-muted-foreground",
        compte: "border-transparent bg-navy-soft text-navy",
        import: "border-transparent bg-warning-border text-warning-deep",
        success: "border-transparent bg-success-soft text-success",
        warning: "border-transparent bg-warning-soft text-warning",
        warn: "border-transparent bg-warning-soft-alt text-warning-strong",
        danger: "border-transparent bg-destructive-soft text-destructive",
        error: "border-transparent bg-destructive-soft text-destructive",
        info: "border-transparent bg-navy-soft text-info",
        system: "border-transparent bg-system-soft text-warning-deep",
        muted: "border-transparent bg-neutral-soft-3 text-ink",
        soft: "border-transparent bg-navy-soft text-navy",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export { badgeVariants };