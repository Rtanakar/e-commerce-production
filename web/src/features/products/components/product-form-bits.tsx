// ============================================================================
// product-form-bits.tsx — SectionCard + Tags + Sizes + Colors + Specs
// ============================================================================
// Chhote reusable form widgets, sab theme-aware (shadcn tokens) + motion.
// ============================================================================

"use client";

import { useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus, X, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { COLOR_SWATCHES } from "@/config/constants";
import type { ProductSpecification } from "../types";

// ============================================================================
// SectionCard — branded chrome around each form group
// ============================================================================
export function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-primary" />
          {title}
        </CardTitle>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

// ============================================================================
// TagListInput — Enter/Add → animated chip
// ============================================================================
export function TagListInput({
  value,
  onChange,
  placeholder = "Type and press Enter",
  disabled,
  max = 25,
  maxLength = 40,
  lowercase = true,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  max?: number;
  maxLength?: number;
  lowercase?: boolean;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const raw = input.trim();
    if (!raw || value.length >= max) return;
    const v = (lowercase ? raw.toLowerCase() : raw).slice(0, maxLength);
    if (value.includes(v)) {
      setInput("");
      return;
    }
    onChange([...value, v]);
    setInput("");
  };
  const remove = (t: string) => onChange(value.filter((x) => x !== t));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && input === "" && value.length) {
      e.preventDefault();
      remove(value[value.length - 1]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled || value.length >= max}
          maxLength={maxLength}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={add}
          disabled={disabled || !input.trim() || value.length >= max}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <AnimatePresence mode="popLayout">
            {value.map((tag) => (
              <motion.span
                key={tag}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs text-primary"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => remove(tag)}
                  disabled={disabled}
                  className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
                >
                  <X className="size-3" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}
      {value.length >= max - 2 && (
        <p className="text-[10px] text-muted-foreground">
          {value.length} / {max}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// SizeSelector — toggle chips (XS S M L ...)
// ============================================================================
export function SizeSelector({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (size: string) =>
    onChange(
      value.includes(size) ? value.filter((s) => s !== size) : [...value, size],
    );

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((size) => {
        const active = value.includes(size);
        return (
          <button
            key={size}
            type="button"
            disabled={disabled}
            onClick={() => toggle(size)}
            className={cn(
              "min-w-10 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {size}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// ColorPicker — swatch row + "+" custom (native color popover)
// ============================================================================
export function ColorPicker({
  value,
  onChange,
  disabled,
  max = 25,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  max?: number;
}) {
  const [custom, setCustom] = useState("#3b82f6");

  const add = (c: string) => {
    const hex = c.toLowerCase();
    if (value.includes(hex) || value.length >= max) return;
    onChange([...value, hex]);
  };
  const remove = (c: string) => onChange(value.filter((x) => x !== c));

  return (
    <div className="space-y-3">
      {/* Selected colors */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <AnimatePresence mode="popLayout">
            {value.map((c) => (
              <motion.button
                key={c}
                type="button"
                layout
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                onClick={() => remove(c)}
                disabled={disabled}
                title={`${c} — click to remove`}
                className="group relative size-8 rounded-full border border-border shadow-sm"
                style={{ background: c }}
              >
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-background text-foreground opacity-0 shadow transition-opacity group-hover:opacity-100">
                  <X className="size-2.5" />
                </span>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Preset swatches + custom */}
      <div className="flex flex-wrap items-center gap-2">
        {COLOR_SWATCHES.map((c) => {
          const active = value.includes(c);
          return (
            <button
              key={c}
              type="button"
              disabled={disabled}
              onClick={() => add(c)}
              title={c}
              className={cn(
                "flex size-7 items-center justify-center rounded-full border transition-transform hover:scale-110",
                active
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border",
              )}
              style={{ background: c }}
            >
              {active && (
                <Check className="size-3 text-white mix-blend-difference" />
              )}
            </button>
          );
        })}

        {/* Custom color popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled || value.length >= max}
              className="flex size-7 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              title="Add custom color"
            >
              <Plus className="size-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">
              Custom color
            </p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="size-9 cursor-pointer rounded border border-border bg-transparent"
              />
              <Input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="h-9 flex-1 font-mono text-xs"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={() => add(custom)}
            >
              Add color
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

// ============================================================================
// SpecificationsInput — custom label/value property rows
// ============================================================================
export function SpecificationsInput({
  value,
  onChange,
  disabled,
}: {
  value: ProductSpecification[];
  onChange: (next: ProductSpecification[]) => void;
  disabled?: boolean;
}) {
  const update = (i: number, patch: Partial<ProductSpecification>) =>
    onChange(value.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, { label: "", value: "" }]);

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {value.map((spec, i) => (
          <motion.div
            key={i}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            <Input
              placeholder="Label (e.g. Material)"
              value={spec.label}
              onChange={(e) => update(i, { label: e.target.value })}
              disabled={disabled}
              className="flex-1"
            />
            <Input
              placeholder="Value (e.g. Cotton)"
              value={spec.value}
              onChange={(e) => update(i, { value: e.target.value })}
              disabled={disabled}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(i)}
              disabled={disabled}
              className="text-muted-foreground hover:text-rose-500"
            >
              <X className="size-4" />
            </Button>
          </motion.div>
        ))}
      </AnimatePresence>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        disabled={disabled}
        className="gap-1.5"
      >
        <Plus className="size-3.5" />
        Add specification
      </Button>
    </div>
  );
}
