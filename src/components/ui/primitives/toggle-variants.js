import { cva } from "class-variance-authority";

export const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md data-[state=on]:bg-accent data-[state=on]:text-accent-foreground " +
    "cursor-pointer font-medium text-sm transition-colors outline-none hover:bg-muted hover:text-muted-foreground " +
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] " +
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 " +
    "[&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent shadow-xs",
      },
      size: {
        default: "h-9 min-w-9 px-2",
        sm: "h-8 min-w-8 px-1.5",
        lg: "h-10 min-w-10 px-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);