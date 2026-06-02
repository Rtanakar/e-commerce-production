// ============================================================================
// use-location.ts — IP-based user location (delivery estimate + currency hint)
// ============================================================================
// Screenshot wala useLocationTracking ka production version:
//   - localStorage cache (20-day expiry) — har mount pe network call nahi
//   - ip-api.com (free, no key) se country/city
//   - SSR-safe (typeof window guard), fail-soft (network down → null, app chale)
//   - delivery estimate helper (location pe based ETA — Amazon "Delivery to X")
//
// NOTE: ip-api free tier HTTP-only + rate-limited (45 req/min). Cache isi liye
// zaroori. Prod me apna geo endpoint ya Cloudflare `cf-ipcountry` header behtar.
// ============================================================================

"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "user_location";
const EXPIRY_DAYS = 20;
const EXPIRY_MS = EXPIRY_DAYS * 24 * 60 * 60 * 1000;

export interface UserLocation {
  country: string;
  countryCode: string;
  city: string;
  region: string;
  currency: string;
  timestamp: number;
}

// ── localStorage se valid (non-expired) location nikaalo ──
function getStored(): UserLocation | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as UserLocation;
    const expired = Date.now() - parsed.timestamp > EXPIRY_MS;
    return expired ? null : parsed;
  } catch {
    return null;
  }
}

export function useLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = getStored();
    if (cached) {
      setLocation(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    // ip-api free endpoint — sirf zaroori fields maangte (bandwidth + privacy)
    fetch(
      "http://ip-api.com/json/?fields=status,country,countryCode,city,regionName,currency",
    )
      .then((res) => res.json())
      .then(
        (data: {
          status?: string;
          country?: string;
          countryCode?: string;
          city?: string;
          regionName?: string;
          currency?: string;
        }) => {
          if (cancelled || data.status !== "success") {
            setLoading(false);
            return;
          }
          const next: UserLocation = {
            country: data.country ?? "",
            countryCode: data.countryCode ?? "",
            city: data.city ?? "",
            region: data.regionName ?? "",
            currency: data.currency ?? "INR",
            timestamp: Date.now(),
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          setLocation(next);
          setLoading(false);
        },
      )
      .catch(() => {
        if (!cancelled) setLoading(false); // network fail → app chalti rahe
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { location, loading };
}

// ============================================================================
// estimateDelivery — location pe based ETA (Amazon "Delivery by Tue, May 13")
// ============================================================================
// Heuristic: metro/known city → 3 din, warna 5-7 din. Real me carrier/pincode
// serviceability API se aata. Abhi simple + deterministic (UI ke liye).
// ============================================================================
export function estimateDelivery(location: UserLocation | null): {
  date: Date;
  label: string;
} {
  const days = location?.city ? 3 : 6; // location pata → faster local estimate
  const date = new Date();
  date.setDate(date.getDate() + days);
  const label = date.toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return { date, label };
}
