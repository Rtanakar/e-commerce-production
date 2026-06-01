// ============================================================================
// confirm-delete-dialog.tsx — Reusable destructive confirm modal
// ============================================================================
// shadcn AlertDialog + framer-motion content. onConfirm async ho sakta hai —
// dialog pending spinner dikhata hai, success pe khud band hota hai, error pe
// khula rehta (caller toast.promise se feedback de). Variant delete, variant/
// gallery image delete, editor node delete — sab isi se confirm karte hain.
// ============================================================================

"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title = "Delete this item?",
  description = "This action cannot be undone.",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** async ho sakta — resolve pe modal band, reject pe khula rehta */
  onConfirm: () => void | Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  const handleConfirm = async () => {
    try {
      setPending(true);
      await onConfirm();
      onOpenChange(false);
    } catch {
      /* caller (toast.promise) ne error dikha diya — modal khula rehne do */
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <AlertDialogContent>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="flex flex-col gap-3"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/15">
              <AlertTriangle className="size-5 text-destructive" />
            </span>
            <div className="space-y-1">
              <AlertDialogTitle className="text-base font-semibold leading-tight">
                {title}
              </AlertDialogTitle>
              <AlertDialogDescription>{description}</AlertDialogDescription>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={handleConfirm}
              className="gap-1.5 bg-destructive text-white hover:bg-destructive/90"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {confirmLabel}
            </Button>
          </div>
        </motion.div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
