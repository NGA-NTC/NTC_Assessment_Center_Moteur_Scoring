import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Spinner({ size = 20, color, className = "", ...props }) {
  return <Loader2 size={size} color={color} className={cn("ntc-spin text-navy", className)} {...props} />;
}