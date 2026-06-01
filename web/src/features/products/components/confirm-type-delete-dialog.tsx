// ============================================================================
// confirm-type-delete-dialog.tsx — "Type delete to confirm" modal
// ============================================================================
// Permanent destructive action (product hard delete) ke liye Cloudflare-style
// guard: user ko confirm word ("delete") type karna padta hai tabhi Delete
// enable hota hai. shadcn Dialog + framer motion. onConfirm async — pending
// spinner, success pe band, error pe khula.
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConfirmTypeDeleteDialog({
  open,
  onOpenChange,
  title = "Delete this item?",
  description,
  confirmWord = "delete",
  confirmLabel = "Delete",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
  description?: React.ReactNode;
  confirmWord?: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);

  // reset input jab modal khule/band ho
  useEffect(() => {
    if (!open) setText("");
  }, [open]);

  const matches = text.trim().toLowerCase() === confirmWord.toLowerCase();

  const handleConfirm = async () => {
    if (!matches) return;
    try {
      setPending(true);
      await onConfirm();
      onOpenChange(false);
    } catch {
      /* caller toast.promise ne error dikha diya */
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-destructive/15">
                <AlertTriangle className="size-4 text-destructive" />
              </span>
              {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">
              Type{" "}
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground">
                {confirmWord}
              </span>{" "}
              to confirm
            </p>
            <Input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={confirmWord}
              disabled={pending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches) {
                  e.preventDefault();
                  void handleConfirm();
                }
              }}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={!matches || pending}
              onClick={handleConfirm}
              className={cn("gap-1.5")}
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
      </DialogContent>
    </Dialog>
  );
}
