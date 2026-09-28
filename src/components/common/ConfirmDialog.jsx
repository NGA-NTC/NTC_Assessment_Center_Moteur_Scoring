import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/primitives/alert-dialog.jsx";
import { buttonVariants } from "../ui/primitives/button-variants.js";
import { cn } from "@/lib/utils";

export default function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title = "Confirmer",
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  loading = false,
  danger = false,
  maxWidth = 440,
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next && !loading) onCancel(); }}>
      <AlertDialogContent style={{ maxWidth }}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className={cn(buttonVariants({ variant: "outline" }))}
            disabled={loading}
            onClick={onCancel}
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: danger ? "destructive" : "default" }))}
            disabled={loading}
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}