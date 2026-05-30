// ============================================================================
// step-shop.tsx — Step 2: Shop setup (name, category, address, optional KYC)
// ============================================================================

"use client";

import { motion } from "motion/react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toast } from "sonner";
import { Loader2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { shopFormSchema, type ShopFormValues } from "../validators/shop";
import {
  SHOP_CATEGORIES,
  shopDefaultValues,
} from "../constants/constants";
import { useSetupShop } from "../hooks/use-setup-shop";

interface Props {
  onDone: () => void;
}

export function StepShop({ onDone }: Props) {
  const setupShop = useSetupShop();

  const form = useForm<ShopFormValues>({
    resolver: standardSchemaResolver(shopFormSchema),
    defaultValues: shopDefaultValues,
  });

  const onSubmit = async (values: ShopFormValues) => {
    // Empty-string → undefined: backend treats absent fields as "no change"
    const blank = (v?: string) => (v && v.length > 0 ? v : undefined);
    try {
      await setupShop.mutateAsync({
        shopName: values.shopName,
        category: values.category,
        description: blank(values.description),
        address: values.address,
        website: blank(values.website),
        gstNumber: blank(values.gstNumber),
        panNumber: blank(values.panNumber),
      });
      toast.success("Shop saved");
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.message.includes("already taken")) {
        form.setError("shopName", { message: "This shop name is taken" });
      } else {
        toast.error("Could not save shop", {
          description: err instanceof Error ? err.message : "Try again",
        });
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border bg-card p-6 shadow-sm sm:p-8"
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Store className="size-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Tell us about your shop
          </h2>
          <p className="text-sm text-muted-foreground">
            Step 2 of 3 — Shop details (can be edited later)
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="shopName">Shop name *</Label>
            <Input
              id="shopName"
              placeholder="Awesome Goods Store"
              {...form.register("shopName")}
            />
            {form.formState.errors.shopName && (
              <p className="text-xs text-destructive">
                {form.formState.errors.shopName.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category">Category *</Label>
            <select
              id="category"
              {...form.register("category")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select category…</option>
              {SHOP_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {form.formState.errors.category && (
              <p className="text-xs text-destructive">
                {form.formState.errors.category.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="website">Website (optional)</Label>
            <Input
              id="website"
              placeholder="https://yoursite.com"
              {...form.register("website")}
            />
            {form.formState.errors.website && (
              <p className="text-xs text-destructive">
                {form.formState.errors.website.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">Shop address *</Label>
            <Textarea
              id="address"
              rows={2}
              placeholder="Street, City, State, Pincode"
              {...form.register("address")}
            />
            {form.formState.errors.address && (
              <p className="text-xs text-destructive">
                {form.formState.errors.address.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="description">Short description</Label>
            <Textarea
              id="description"
              rows={2}
              placeholder="What do you sell?"
              {...form.register("description")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gstNumber">GSTIN (optional)</Label>
            <Input
              id="gstNumber"
              placeholder="22AAAAA0000A1Z5"
              {...form.register("gstNumber")}
              className="uppercase"
            />
            {form.formState.errors.gstNumber && (
              <p className="text-xs text-destructive">
                {form.formState.errors.gstNumber.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="panNumber">PAN (optional)</Label>
            <Input
              id="panNumber"
              placeholder="ABCDE1234F"
              {...form.register("panNumber")}
              className="uppercase"
            />
            {form.formState.errors.panNumber && (
              <p className="text-xs text-destructive">
                {form.formState.errors.panNumber.message}
              </p>
            )}
          </div>
        </div>

        <Button
          type="submit"
          disabled={setupShop.isPending}
          className="w-full"
        >
          {setupShop.isPending && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}
          Save & continue to bank setup
        </Button>
      </form>
    </motion.div>
  );
}
