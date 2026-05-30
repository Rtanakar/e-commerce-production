import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================================================
// getInitials — avatar fallback from a name (max 2 chars, uppercase)
// ============================================================================
// "Shahriar Ahmed" → "SA", "becodemy" → "BE", undefined → "U".
export function getInitials(name?: string | null): string {
  if (!name?.trim()) return "U"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}
