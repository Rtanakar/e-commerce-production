// ============================================================================
// discount-create-dialog.tsx — create / edit a discount code (shared)
// ============================================================================
// Product form ke DiscountSelector se inline create, aur discount-codes
// management page se create/edit — dono yahi dialog use karte hain.
//
// value semantics: PERCENT → 1..100. FLAT → form me RUPEES, submit pe minor
// units (×100). Edit me minor → rupees (÷100) dikhate hain.
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateDiscount, useUpdateDiscount } from "../hooks/use-discounts";
import type { DiscountCode, DiscountType } from "../types";

const LABEL = "text-xs font-medium uppercase tracking-wider text-muted-foreground";

interface Draft {
  code: string;
  title: string;
  type: DiscountType;
  value: number; // PERCENT: %, FLAT: rupees (UI)
  minOrder: number; // rupees
  maxUses: number | "";
  isActive: boolean;
}

const EMPTY: Draft = {
  code: "",
  title: "",
  type: "PERCENT",
  value: 10,
  minOrder: 0,
  maxUses: "",
  isActive: true,
};

function toDraft(dc: DiscountCode): Draft {
  return {
    code: dc.code,
    title: dc.title ?? "",
    type: dc.type,
    value: dc.type === "FLAT" ? dc.value / 100 : dc.value,
    minOrder: (dc.minOrder ?? 0) / 100,
    maxUses: dc.maxUses ?? "",
    isActive: dc.isActive,
  };
}

export function DiscountCreateDialog({
  open,
  onOpenChange,
  edit,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** present → edit mode */
  edit?: DiscountCode | null;
  onSaved?: (dc: DiscountCode) => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const create = useCreateDiscount();
  const update = useUpdateDiscount();
  const isEdit = !!edit;
  const busy = create.isPending || update.isPending;

  // open / edit change → draft sync
  useEffect(() => {
    if (open) setDraft(edit ? toDraft(edit) : EMPTY);
  }, [open, edit]);

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const submit = async () => {
    const code = draft.code.trim().toUpperCase();
    if (code.length < 3) {
      toast.error("Code must be at least 3 characters");
      return;
    }
    if (draft.type === "PERCENT" && (draft.value < 1 || draft.value > 100)) {
      toast.error("Percent must be 1–100");
      return;
    }
    if (draft.value <= 0) {
      toast.error("Value must be greater than 0");
      return;
    }

    // build payload (FLAT/minOrder → minor units)
    const payload = {
      code,
      title: draft.title.trim() || undefined,
      type: draft.type,
      value: draft.type === "FLAT" ? Math.round(draft.value * 100) : draft.value,
      minOrder: draft.minOrder > 0 ? Math.round(draft.minOrder * 100) : null,
      maxUses: draft.maxUses === "" ? null : Number(draft.maxUses),
      isActive: draft.isActive,
    };

    try {
      const dc = isEdit
        ? await update.mutateAsync({ id: edit!.id, data: payload })
        : await create.mutateAsync(payload);
      toast.success(isEdit ? "Discount updated" : `Code “${dc.code}” created`);
      onSaved?.(dc);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit discount code" : "New discount code"}</DialogTitle>
          <DialogDescription>
            Buyers enter this code at checkout. Attach it to products from the form.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel className={LABEL}>Code *</FieldLabel>
              <Input
                value={draft.code}
                onChange={(e) => patch({ code: e.target.value.toUpperCase() })}
                placeholder="FLASH10"
                maxLength={30}
                className="font-mono uppercase"
              />
            </Field>
            <Field>
              <FieldLabel className={LABEL}>Title</FieldLabel>
              <Input
                value={draft.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="Flash sale"
                maxLength={120}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel className={LABEL}>Type</FieldLabel>
              <Select value={draft.type} onValueChange={(v) => patch({ type: v as DiscountType })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">Percentage (%)</SelectItem>
                  <SelectItem value="FLAT">Flat (₹)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel className={LABEL}>
                {draft.type === "PERCENT" ? "Percent (1–100)" : "Amount (₹)"}
              </FieldLabel>
              <Input
                type="number"
                min={draft.type === "PERCENT" ? 1 : 0}
                max={draft.type === "PERCENT" ? 100 : undefined}
                value={draft.value}
                onChange={(e) => patch({ value: Number(e.target.value) || 0 })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel className={LABEL}>Min order (₹)</FieldLabel>
              <Input
                type="number"
                min={0}
                value={draft.minOrder}
                onChange={(e) => patch({ minOrder: Number(e.target.value) || 0 })}
                placeholder="0"
              />
            </Field>
            <Field>
              <FieldLabel className={LABEL}>Max uses</FieldLabel>
              <Input
                type="number"
                min={1}
                value={draft.maxUses}
                onChange={(e) => patch({ maxUses: e.target.value === "" ? "" : Number(e.target.value) })}
                placeholder="Unlimited"
              />
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-card/40 px-4 py-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Active</p>
              <p className="text-[11px] text-muted-foreground">Inactive codes can&apos;t be redeemed</p>
            </div>
            <Switch checked={draft.isActive} onCheckedChange={(v) => patch({ isActive: v })} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy || !draft.code.trim()} className="gap-1.5">
            {busy && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create code"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
