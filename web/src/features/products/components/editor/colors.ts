// ============================================================================
// colors.ts — text-color palette for the bubble-menu color picker
// ============================================================================
// Content colors (theme-neutral hex). "default" = unset (inherits foreground).
// ============================================================================

export interface ColorSwatch {
  id: string;
  label: string;
  value: string; // "" = unset
}

export const TEXT_COLORS: ColorSwatch[] = [
  { id: "default", label: "Default", value: "" },
  { id: "gray", label: "Gray", value: "#6b7280" },
  { id: "brown", label: "Brown", value: "#a16207" },
  { id: "orange", label: "Orange", value: "#f97316" },
  { id: "amber", label: "Amber", value: "#f59e0b" },
  { id: "emerald", label: "Emerald", value: "#10b981" },
  { id: "blue", label: "Blue", value: "#3b82f6" },
  { id: "violet", label: "Violet", value: "#8b5cf6" },
  { id: "pink", label: "Pink", value: "#ec4899" },
  { id: "rose", label: "Rose", value: "#f43f5e" },
  { id: "red", label: "Red", value: "#ef4444" },
  { id: "teal", label: "Teal", value: "#14b8a6" },
];
