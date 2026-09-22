import { cva } from "class-variance-authority";

// Hauteurs calées sur --ntc-control-height / -sm / -lg (44 / 36 / 50 px)
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive: "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "border border-border bg-transparent text-navy shadow-xs hover:bg-navy/[0.06] hover:border-navy/20",
        link: "text-primary underline-offset-4 hover:underline",
        // Variants NTC (miroir de l'existant : Button.jsx)
        outlineDark: "border border-border bg-surface text-navy shadow-xs hover:bg-navy/[0.06]",
        outlineSidebar: "border border-white/20 bg-white/5 text-white hover:bg-white/10",
      },
      size: {
        default: "h-11 px-5 py-2 has-[>svg]:px-3",
        sm: "h-9 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-[50px] rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export { buttonVariants };