// ============================================================================
// link-dialog.tsx — TipTap link editor modal (shadcn Dialog + framer motion)
// ============================================================================
// window.prompt ki jagah — proper modal me URL input. Apply / Remove link.
// Enter pe apply (valid http(s) URL). Editor host state se control hota hai.
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Link as LinkIcon, Unlink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function LinkDialog({
  open,
  onOpenChange,
  initialUrl,
  onApply,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialUrl: string;
  onApply: (url: string) => void;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState(initialUrl);

  // modal khulne par current href se sync
  useEffect(() => {
    if (open) setUrl(initialUrl);
  }, [open, initialUrl]);

  const trimmed = url.trim();
  const valid = /^https?:\/\/.+/i.test(trimmed);
  const hasExisting = !!initialUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="size-4 text-primary" />
              {hasExisting ? "Edit link" : "Add link"}
            </DialogTitle>
            <DialogDescription>
              Paste a full URL (https://…). Selected text isse link ban jayega.
            </DialogDescription>
          </DialogHeader>

          <Input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            onKeyDown={(e) => {
              if (e.key === "Enter" && valid) {
                e.preventDefault();
                onApply(trimmed);
              }
            }}
          />
          {url && !valid && (
            <p className="text-[11px] text-destructive">
              URL http:// ya https:// se shuru hona chahiye
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            {hasExisting ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRemove}
                className="gap-1.5 text-muted-foreground hover:text-rose-500"
              >
                <Unlink className="size-4" /> Remove link
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="button"
              size="sm"
              disabled={!valid}
              onClick={() => onApply(trimmed)}
              className="gap-1.5"
            >
              <LinkIcon className="size-4" /> {hasExisting ? "Update" : "Apply"}
            </Button>
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
