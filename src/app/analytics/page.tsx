"use client";

import { useState, useMemo, lazy, Suspense } from "react";
import {
  Send,
  CheckCircle2,
  MessageCircle,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { QualityRating } from "@/lib/types";

const AnalyticsCharts = lazy(() => import("@/components/AnalyticsCharts"));

const kpis = [
  { label: "Total Sent", value: 24_850, delta: +12.3, icon: Send },
  { label: "Delivered", value: 23_120, delta: +8.7, icon: CheckCircle2 },
  { label: "Responded", value: 4_230, delta: -2.1, icon: MessageCircle },
  { label: "Block Rate", value: 1.2, delta: -0.3, icon: ShieldAlert, suffix: "%" },
];

const campaignBlockRates = [
  { name: "Flash Sale", block_rate: 3.2, sent: 6200, blocked: 198 },
  { name: "Re-engage VIP", block_rate: 1.8, sent: 4800, blocked: 86 },
  { name: "June Retention", block_rate: 0.9, sent: 5200, blocked: 47 },
  { name: "Welcome Flow", block_rate: 0.4, sent: 3100, blocked: 12 },
  { name: "Feedback Ask", block_rate: 0.2, sent: 2800, blocked: 6 },
];

const errorBreakdown = [
  { code: "131049", label: "Per-user frequency cap hit", count: 142 },
  { code: "130429", label: "Rate limit (account tier)", count: 38 },
  { code: "131047", label: "Re-engagement window expired", count: 67 },
];

const qualityRating: QualityRating = "GREEN";

function QualityBadge({ rating }: { rating: QualityRating }) {
  const config = {
    GREEN: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", label: "High" },
    YELLOW: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200", label: "Medium" },
    RED: { bg: "bg-red-100", text: "text-red-700", border: "border-red-200", label: "Low" },
  }[rating];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${config.bg} ${config.text} ${config.border}`}>
      <span className={`size-2 rounded-full ${rating === "GREEN" ? "bg-emerald-500" : rating === "YELLOW" ? "bg-amber-500" : "bg-red-500"}`} />
      Quality: {config.label}
    </span>
  );
}

function ChartFallback() {
  return (
    <div className="flex items-center justify-center h-[280px] text-muted-foreground">
      <Loader2 size={24} className="animate-spin" />
    </div>
  );
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("7d");

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Campaign performance and delivery health.</p>
        </div>
        <div className="flex items-center gap-3">
          <QualityBadge rating={qualityRating} />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="h-9 rounded-lg border border-border bg-white px-3 text-sm font-medium text-foreground outline-none"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ label, value, delta, icon: Icon, suffix }) => (
          <div key={label} className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
              <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                <Icon size={18} />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold text-foreground">
              {suffix ? value : new Intl.NumberFormat("en-IN").format(value)}
              {suffix}
            </p>
            <div className={`mt-2 flex items-center gap-1 text-xs font-semibold ${delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {delta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {delta >= 0 ? "+" : ""}{delta}% vs last 7d
            </div>
          </div>
        ))}
      </div>

      {/* Charts — lazy loaded */}
      <Suspense fallback={<ChartFallback />}>
        <AnalyticsCharts />
      </Suspense>

      {/* Block rate table + error codes */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Campaigns by Block Rate</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Campaign</th>
                <th className="px-5 py-3 text-right">Sent</th>
                <th className="px-5 py-3 text-right">Blocked</th>
                <th className="px-5 py-3 text-right">Block Rate</th>
                <th className="px-5 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaignBlockRates.map((c) => (
                <tr key={c.name} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-foreground">{c.name}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground">{c.sent.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground">{c.blocked}</td>
                  <td className="px-5 py-3 text-right font-semibold">{c.block_rate}%</td>
                  <td className="px-5 py-3 text-center">
                    {c.block_rate > 1.5 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700">
                        <AlertTriangle size={10} /> Flagged
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Error Code Breakdown</h2>
          </div>
          <div className="p-5 space-y-4">
            {errorBreakdown.map((err) => (
              <div key={err.code} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <code className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">{err.code}</code>
                  <span className="text-lg font-bold text-foreground">{err.count}</span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{err.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
