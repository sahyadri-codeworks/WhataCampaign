"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, Loader2, Pause, Play, XCircle, AlertTriangle, CheckCircle2,
  Send, Users, Clock, Shield, BarChart3, Eye, RefreshCw,
} from "lucide-react";
import { useParams } from "next/navigation";
import type { CampaignProgress } from "@/lib/types";

type CampaignDetail = {
  id: string; name: string; category: string; status: string;
  template_name: string | null; launched_at: string | null;
  daily_limit: number; cooldown_hours: number; priority_mode: string;
  send_window_start: string; send_window_end: string;
};

let RechartsModule: typeof import("recharts") | null = null;

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    import("recharts").then((mod) => { RechartsModule = mod; setChartsReady(true); });
  }, []);

  const fetchProgress = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/campaigns/${id}/status`);
      const data = await res.json();
      if (!data.error) setProgress(data);
    } catch { /* ignore */ }
  }, [id]);

  const fetchCampaign = useCallback(async () => {
    if (!id) return;
    try {
      const { supabase } = await import("@/lib/supabase");
      if (!supabase) return;
      const { data } = await supabase.from("campaigns")
        .select("id, name, category, status, template_name, launched_at, daily_limit, cooldown_hours, priority_mode, send_window_start, send_window_end")
        .eq("id", id).single();
      if (data) setCampaign(data as CampaignDetail);
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchCampaign(); fetchProgress(); }, [fetchCampaign, fetchProgress]);

  // Poll while active
  useEffect(() => {
    if (!progress || !["active", "sending"].includes(progress.status)) return;
    const interval = setInterval(fetchProgress, 10000);
    return () => clearInterval(interval);
  }, [progress, fetchProgress]);

  async function performAction(action: "pause" | "resume" | "cancel") {
    setActionLoading(true);
    try {
      await fetch(`/api/campaigns/${id}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await fetchCampaign();
      await fetchProgress();
    } catch { /* ignore */ }
    setActionLoading(false);
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-purple-400" /></div>;
  }

  if (!campaign) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <AlertTriangle size={40} className="mx-auto text-amber-400" />
        <h1 className="text-xl font-bold">Campaign Not Found</h1>
        <a href="/campaigns" className="text-purple-600 font-semibold hover:underline">Back to campaigns</a>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600", planned: "bg-indigo-50 text-indigo-700",
    active: "bg-purple-50 text-purple-700", sending: "bg-purple-50 text-purple-700",
    paused: "bg-amber-50 text-amber-700", completed: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-red-50 text-red-700",
  };

  const isActive = ["active", "sending"].includes(campaign.status);
  const isPaused = campaign.status === "paused";
  const totalJobs = progress?.total_jobs ?? 0;
  const sent = progress?.sent ?? 0;
  const progressPct = totalJobs > 0 ? (sent / totalJobs) * 100 : 0;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <a href="/campaigns" className="p-2 rounded-lg hover:bg-muted"><ArrowLeft size={18} /></a>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold capitalize ${statusColors[campaign.status] ?? statusColors.draft}`}>
              {campaign.status}
            </span>
            <span className="text-xs text-muted-foreground">{campaign.category}</span>
            {campaign.launched_at && (
              <span className="text-xs text-muted-foreground">· Launched {new Date(campaign.launched_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {isActive && (
            <button onClick={() => performAction("pause")} disabled={actionLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100">
              <Pause size={12} /> Pause
            </button>
          )}
          {isPaused && (
            <button onClick={() => performAction("resume")} disabled={actionLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
              <Play size={12} /> Resume
            </button>
          )}
          {(isActive || isPaused) && (
            <button onClick={() => performAction("cancel")} disabled={actionLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">
              <XCircle size={12} /> Cancel
            </button>
          )}
          <button onClick={() => { fetchCampaign(); fetchProgress(); }}
            className="p-2 rounded-lg border hover:bg-muted"><RefreshCw size={14} /></button>
        </div>
      </div>

      {/* Auto-pause warning */}
      {isPaused && progress && progress.block_rate > 2 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-800">Campaign Auto-Paused</p>
            <p className="text-xs text-red-700 mt-1">Block rate exceeded 2% ({progress.block_rate.toFixed(1)}%). Review your audience and message content before resuming.</p>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {progress && totalJobs > 0 && (
        <div className="rounded-xl border bg-white p-4 space-y-2">
          <div className="flex justify-between text-xs font-semibold">
            <span>{sent.toLocaleString()} / {totalJobs.toLocaleString()} sent</span>
            <span>{progressPct.toFixed(1)}%</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-purple-600 transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {/* Stats cards */}
      {progress && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Sent", value: progress.sent, icon: Send, color: "text-purple-700 bg-purple-50 border-purple-200" },
            { label: "Delivered", value: progress.delivered, icon: CheckCircle2, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
            { label: "Failed", value: progress.failed, icon: AlertTriangle, color: "text-red-700 bg-red-50 border-red-200" },
            { label: "Pending", value: progress.pending, icon: Clock, color: "text-blue-700 bg-blue-50 border-blue-200" },
            { label: "ETA", value: progress.eta_hours !== null ? `${progress.eta_hours}h` : "—", icon: BarChart3, color: "text-gray-700 bg-gray-50 border-gray-200" },
          ].map((c) => (
            <div key={c.label} className={`rounded-xl border p-4 ${c.color}`}>
              <c.icon size={14} className="mb-1 opacity-70" />
              <p className="text-xl font-bold">{typeof c.value === "number" ? c.value.toLocaleString() : c.value}</p>
              <p className="text-[10px] font-bold uppercase opacity-70">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Quality rating */}
      {progress?.quality_rating && (
        <div className="flex items-center gap-2 rounded-lg border p-3">
          <Shield size={14} className="text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">Quality Rating:</span>
          <span className={`inline-flex items-center gap-1 text-xs font-bold ${
            progress.quality_rating === "GREEN" ? "text-emerald-700" :
            progress.quality_rating === "YELLOW" ? "text-amber-700" : "text-red-700"
          }`}>
            <span className={`size-2 rounded-full ${
              progress.quality_rating === "GREEN" ? "bg-emerald-500" :
              progress.quality_rating === "YELLOW" ? "bg-amber-500" : "bg-red-500"
            }`} />
            {progress.quality_rating}
          </span>
          {progress.block_rate > 0 && (
            <span className="text-xs text-muted-foreground ml-2">Block rate: {progress.block_rate.toFixed(2)}%</span>
          )}
        </div>
      )}

      {/* Daily breakdown chart */}
      {chartsReady && RechartsModule && progress && progress.daily_batches.length > 0 && (
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-bold text-muted-foreground mb-3 uppercase">Daily Performance</p>
          <div className="h-[200px]">
            <RechartsModule.ResponsiveContainer width="100%" height="100%">
              <RechartsModule.BarChart data={progress.daily_batches.map((b) => ({
                date: b.date.slice(5), sent: b.sent, delivered: b.delivered, failed: b.failed,
              }))}>
                <RechartsModule.XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <RechartsModule.YAxis tick={{ fontSize: 10 }} />
                <RechartsModule.Tooltip />
                <RechartsModule.Legend wrapperStyle={{ fontSize: 10 }} />
                <RechartsModule.Bar dataKey="sent" fill="#7c3aed" radius={[2, 2, 0, 0]} />
                <RechartsModule.Bar dataKey="delivered" fill="#10b981" radius={[2, 2, 0, 0]} />
                <RechartsModule.Bar dataKey="failed" fill="#ef4444" radius={[2, 2, 0, 0]} />
              </RechartsModule.BarChart>
            </RechartsModule.ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Daily breakdown table */}
      {progress && progress.daily_batches.length > 0 && (
        <div className="rounded-xl border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Planned</th>
                <th className="px-4 py-3 text-right">Sent</th>
                <th className="px-4 py-3 text-right">Delivered</th>
                <th className="px-4 py-3 text-right">Failed</th>
                <th className="px-4 py-3 text-right">Block Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {progress.daily_batches.map((b) => (
                <tr key={b.date} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-semibold">{b.date}</td>
                  <td className="px-4 py-3 text-right">{b.total.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-semibold text-purple-700">{b.sent.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-emerald-700">{b.delivered.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-red-700">{b.failed.toLocaleString()}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${b.block_rate > 0.02 ? "text-red-700" : "text-muted-foreground"}`}>
                    {(b.block_rate * 100).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Campaign config summary */}
      <div className="rounded-xl border bg-white p-4">
        <p className="text-xs font-bold text-muted-foreground mb-3 uppercase">Configuration</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {[
            ["Daily Cap", campaign.daily_limit?.toLocaleString() ?? "—"],
            ["Cooldown", `${campaign.cooldown_hours ?? 48}h`],
            ["Priority", campaign.priority_mode?.replace("_", " ") ?? "engagement"],
            ["Send Window", `${campaign.send_window_start ?? "10:00"} – ${campaign.send_window_end ?? "19:00"}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">{k}</p>
              <p className="font-semibold mt-0.5 capitalize">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
