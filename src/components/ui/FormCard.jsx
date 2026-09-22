import { cn } from "@/lib/utils";

export default function FormCard({ children, onSubmit, style, className, ...props }) {
  return (
    <form
      onSubmit={onSubmit}
      {...props}
      className={cn("rounded-xl border border-border bg-surface px-[26px] pt-[26px] pb-6 shadow-card", className)}
      style={style}
    >
      {children}
    </form>
  );
}