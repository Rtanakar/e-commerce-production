// ============================================================================
// step-blocked.tsx — Admin role cannot become seller (separation of duties)
// ============================================================================

"use client";

import { motion } from "motion/react";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shopUrl } from "@/lib/portal-urls";

export function StepBlocked() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border bg-card p-8 text-center shadow-sm"
    >
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
        <ShieldX className="size-7" />
      </div>
      <h2 className="text-xl font-semibold">Admin accounts can&apos;t sell</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        For security and separation of duties, admin accounts cannot be
        converted to seller accounts. Use a separate email to register as a
        seller.
      </p>
      <Button asChild className="mt-6" variant="outline">
        {/* Cross-host → shop origin */}
        <a href={shopUrl("/")}>Back to home</a>
      </Button>
    </motion.div>
  );
}
