// ============================================================================
// analytics-charts.tsx — Category pie + Status bar (recharts + shadcn chart)
// ============================================================================
// Dashboard: "kis category ka kaunsa product" pie + status bar graph. Skeleton
// + empty states. Theme-aware (chart CSS vars --chart-1..5).
// ============================================================================

"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import {
  Pie,
  PieChart,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  LabelList,
} from "recharts";
import { PieChart as PieIcon, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  useCategoryDistribution,
  useStatusDistribution,
} from "../hooks/use-product-analytics";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function ChartShell({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ChartSkeleton({ round }: { round?: boolean }) {
  return (
    <div className="flex h-60 items-center justify-center">
      {round ? (
        <Skeleton className="size-40 rounded-full" />
      ) : (
        <div className="flex h-full w-full items-end gap-3 px-4 pb-6">
          {[60, 90, 40, 75].map((h, i) => (
            <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Category pie — products share by category
// ============================================================================
export function CategoryPieChart() {
  const { data, isLoading } = useCategoryDistribution();

  const chartData = useMemo(
    () => data.map((d, i) => ({ ...d, fill: PALETTE[i % PALETTE.length] })),
    [data],
  );

  const config = useMemo<ChartConfig>(() => {
    const c: ChartConfig = { count: { label: "Products" } };
    data.forEach((d, i) => {
      c[d.name] = { label: d.name, color: PALETTE[i % PALETTE.length] };
    });
    return c;
  }, [data]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <ChartShell icon={PieIcon} title="Products by category">
        {isLoading ? (
          <ChartSkeleton round />
        ) : chartData.length === 0 ? (
          <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
            No products yet
          </div>
        ) : (
          <ChartContainer
            config={config}
            className="mx-auto aspect-square max-h-60"
          >
            <PieChart>
              <ChartTooltip
                content={<ChartTooltipContent nameKey="name" hideLabel />}
              />
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="name"
                innerRadius={55}
                strokeWidth={2}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend
                content={<ChartLegendContent nameKey="name" />}
                className="flex-wrap"
              />
            </PieChart>
          </ChartContainer>
        )}
      </ChartShell>
    </motion.div>
  );
}

// ============================================================================
// Status bar — products count by status
// ============================================================================
export function StatusBarChart() {
  const { data, isLoading } = useStatusDistribution();

  const config: ChartConfig = {
    count: { label: "Products", color: "var(--chart-1)" },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
    >
      <ChartShell icon={BarChart3} title="Products by status">
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <ChartContainer config={config} className="max-h-60 w-full">
            <BarChart
              data={data}
              margin={{ top: 16, right: 8, left: -16, bottom: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                fontSize={11}
                width={32}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--chart-1)" radius={[6, 6, 0, 0]}>
                <LabelList
                  dataKey="count"
                  position="top"
                  className="fill-foreground"
                  fontSize={11}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </ChartShell>
    </motion.div>
  );
}
