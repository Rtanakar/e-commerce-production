// ============================================================================
// ai-insights-panel.tsx — AI summary (Sales / Inventory / Action items)
// ============================================================================
// Inspired by the reference "AI Insights" card: three columns of bite-sized,
// scannable callouts. Currently fed by clearly-labelled MOCK data — swap to a
// real `/seller/insights` endpoint when the analytics service lands.
//
// Tone tokens map to theme-aware tints (emerald/amber/rose/primary) so urgent
// vs opportunity items stay legible in both light and dark.
// ============================================================================

"use client";

import { motion } from "motion/react";
import {
  Sparkles,
  RefreshCw,
  TrendingUp,
  Boxes,
  ListChecks,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "good" | "warn" | "urgent" | "tip";

interface InsightLine {
  tone: Tone;
  text: string;
}

interface InsightColumn {
  title: string;
  icon: LucideIcon;
  lines: InsightLine[];
}

// ── MOCK insights — replace with GET /seller/insights ───────────────────────
const COLUMNS: InsightColumn[] = [
  {
    title: "Sales Trends",
    icon: TrendingUp,
    lines: [
      { tone: "good", text: "Revenue up 18% WoW — strongest week this month." },
      { tone: "good", text: "Wireless earbuds are your top performer (42 units)." },
      { tone: "tip", text: "Repeat-customer rate climbing — consider a loyalty coupon." },
    ],
  },
  {
    title: "Inventory",
    icon: Boxes,
    lines: [
      { tone: "urgent", text: "iPhone 15 case — only 3 left, high velocity." },
      { tone: "warn", text: "62 units of slow-moving stock tying up capital." },
      { tone: "tip", text: "Bundle slow movers with bestsellers to clear them." },
    ],
  },
  {
    title: "Action Items",
    icon: ListChecks,
    lines: [
      { tone: "urgent", text: "2 orders pending > 48h — ship today to keep rating." },
      { tone: "warn", text: "Restock iPhone 15 case before the weekend spike." },
      { tone: "tip", text: "Launch a clearance on 3 overstocked SKUs." },
    ],
  },
];

const TONE: Record<Tone, { icon: LucideIcon; cls: string }> = {
  good: { icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" },
  warn: { icon: AlertTriangle, cls: "text-amber-600 dark:text-amber-400" },
  urgent: { icon: AlertTriangle, cls: "text-rose-600 dark:text-rose-400" },
  tip: { icon: Lightbulb, cls: "text-primary" },
};

export function AiInsightsPanel() {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              AI Insights
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Auto-generated from your last 7 days
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="hidden text-[10px] sm:inline-flex">
            Beta
          </Badge>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
            <RefreshCw className="size-3" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Columns */}
      <div className="grid gap-px bg-border md:grid-cols-3">
        {COLUMNS.map((col, ci) => (
          <div key={col.title} className="bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <col.icon className="size-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {col.title}
              </h3>
            </div>
            <ul className="space-y-2.5">
              {col.lines.map((line, li) => {
                const t = TONE[line.tone];
                return (
                  <motion.li
                    key={li}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: ci * 0.06 + li * 0.04 }}
                    className="flex items-start gap-2 text-[13px] leading-snug text-foreground/90"
                  >
                    <t.icon className={cn("mt-0.5 size-3.5 shrink-0", t.cls)} />
                    <span>{line.text}</span>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
