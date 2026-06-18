"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, ChevronRight, ChevronLeft, Sparkles, Loader2, CheckCircle2, X, Clock,
  Send, FileText, Users, Calendar, Eye, Lightbulb, AlertTriangle, Trash2, Info, Plug,
  Target, Zap, BarChart3, Shield, ArrowRight, Settings2, Layers,
} from "lucide-react";
import { useApp } from "@/lib/AppContext";
import { supabase } from "@/lib/supabase";
import type {
  TemplateCategory, AiReviewResult, CampaignPlan, CampaignSortConfig,
  PriorityMode, PriorityWeights, SequenceStepDef, SequenceCondition, CustomFilterRule,
} from "@/lib/types";

// ── Local types ──────────────────────────────────────────────

type DBCampaign = {
  id: string; name: string; category: string; template_name: string | null;
  status: string; total_sent: number; total_delivered: number; created_at: string;
  launched_at: string | null; plan_generated_at: string | null;
};
type DBConnector = { id: string; name: string; type: string; status: string; is_fallback: boolean; messaging_tier: string | null };
type DBSegment = { id: string; name: string; contact_count: number };

const STEPS = [
  { label: "Details", icon: FileText },
  { label: "Connector", icon: Plug },
  { label: "Audience", icon: Users },
  { label: "Rules", icon: Settings2 },
  { label: "Sequence", icon: Layers },
  { label: "AI Review", icon: Sparkles },
  { label: "Plan", icon: BarChart3 },
  { label: "Launch", icon: Send },
];

const TIER_LIMITS: Record<string, number> = {
  TIER_1: 1000, TIER_2: 10000, TIER_3: 100000, TIER_4: 1000000,
  "Tier 1": 1000, "Tier 2": 10000, "Tier 3": 100000, "Unlimited": 1000000,
};

const COOLDOWN_OPTIONS = [
  { value: 24, label: "24 hours (minimum)" },
  { value: 48, label: "48 hours (recommended)" },
  { value: 72, label: "72 hours" },
  { value: 168, label: "7 days" },
];

const PRIORITY_PRESETS: Record<PriorityMode, PriorityWeights> = {
  engagement: { engagement: 40, recency: 20, tag: 20, optin: 20 },
  recency: { engagement: 10, recency: 60, tag: 20, optin: 10 },
  tag_priority: { engagement: 10, recency: 10, tag: 70, optin: 10 },
  round_robin: { engagement: 25, recency: 25, tag: 25, optin: 25 },
};

// ── Badge helpers ────────────────────────────────────────────

function statusBadge(s: string) {
  const m: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600", planned: "bg-indigo-50 text-indigo-700",
    scheduled: "bg-blue-50 text-blue-700", active: "bg-purple-50 text-purple-700",
    sending: "bg-purple-50 text-purple-700", completed: "bg-emerald-50 text-emerald-700",
    paused: "bg-amber-50 text-amber-700", cancelled: "bg-red-50 text-red-700",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold capitalize ${m[s] ?? m.draft}`}>{s}</span>;
}

function catBadge(c: string) {
  const m: Record<string, string> = {
    Marketing: "bg-purple-50 text-purple-700 border-purple-200",
    Utility: "bg-blue-50 text-blue-700 border-blue-200",
    Authentication: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${m[c] ?? m.Marketing}`}>{c}</span>;
}

// ── Plan Review Charts (inline, uses Recharts) ───────────────

let RechartsBar: typeof import("recharts") | null = null;

function PlanReviewUI({ plan, onEdit, onLaunch, launching }: {
  plan: CampaignPlan; onEdit: () => void; onLaunch: () => void; launching: boolean;
}) {
  const [chartsLoaded, setChartsLoaded] = useState(false);

  useEffect(() => {
    import("recharts").then((mod) => {
      RechartsBar = mod;
      setChartsLoaded(true);
    });
  }, []);

  const eb = plan.exclusion_breakdown;
  const exclusionRows = [
    { reason: "Opted out", count: eb.opted_out },
    { reason: "Cooldown active", count: eb.cooldown_active },
    { reason: "Missing marketing opt-in", count: eb.optin_missing },
    { reason: "Frequency capped", count: eb.freq_capped },
    { reason: "Excluded by tag", count: eb.excluded_by_tag },
  ].filter((r) => r.count > 0);

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Eligible", value: plan.total_contacts_eligible.toLocaleString(), color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: Users },
          { label: "Excluded", value: plan.total_contacts_excluded.toLocaleString(), color: "text-red-700 bg-red-50 border-red-200", icon: Shield },
          { label: "Days", value: String(plan.estimated_days_to_complete), color: "text-blue-700 bg-blue-50 border-blue-200", icon: Calendar },
          { label: "Est. Delivery", value: plan.estimated_delivery_rate, color: "text-purple-700 bg-purple-50 border-purple-200", icon: Target },
        ].map((c) => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.color}`}>
            <c.icon size={16} className="mb-1 opacity-70" />
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-[10px] font-bold uppercase opacity-70">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Timeline chart */}
      {chartsLoaded && RechartsBar && plan.daily_schedule.length > 0 && (
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-bold text-muted-foreground mb-3 uppercase">Daily Send Schedule</p>
          <div className="h-[200px]">
            <RechartsBar.ResponsiveContainer width="100%" height="100%">
              <RechartsBar.BarChart data={plan.daily_schedule.map((d) => ({ date: d.date.slice(5), contacts: d.batch_size }))}>
                <RechartsBar.XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <RechartsBar.YAxis tick={{ fontSize: 10 }} />
                <RechartsBar.Tooltip />
                <RechartsBar.Bar dataKey="contacts" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </RechartsBar.BarChart>
            </RechartsBar.ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Exclusion breakdown */}
      {exclusionRows.length > 0 && (
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-bold text-muted-foreground mb-3 uppercase">Exclusion Breakdown</p>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase">
              <tr><th className="text-left pb-2">Reason</th><th className="text-right pb-2">Count</th></tr>
            </thead>
            <tbody className="divide-y">
              {exclusionRows.map((r) => (
                <tr key={r.reason}><td className="py-2">{r.reason}</td><td className="text-right font-bold">{r.count.toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sequence steps */}
      {plan.sequence_steps.length > 1 && (
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-bold text-muted-foreground mb-3 uppercase">Message Sequence</p>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {plan.sequence_steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="rounded-lg border bg-purple-50 border-purple-200 px-3 py-2 min-w-[120px]">
                  <p className="text-[10px] font-bold text-purple-600">DAY {s.day_offset}</p>
                  <p className="text-xs font-semibold truncate">{s.template_name}</p>
                  {s.condition !== "always" && (
                    <p className="text-[9px] text-purple-500 mt-0.5">if {s.condition.replace("_", " ")}</p>
                  )}
                </div>
                {i < plan.sequence_steps.length - 1 && <ArrowRight size={14} className="text-muted-foreground shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {plan.warnings.length > 0 && (
        <div className="space-y-2">
          {plan.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">{w}</p>
            </div>
          ))}
        </div>
      )}

      {/* CTAs */}
      <div className="flex gap-3">
        <button onClick={onEdit} className="flex-1 h-11 rounded-lg border font-semibold text-sm hover:bg-muted">
          Edit Rules
        </button>
        <button onClick={onLaunch} disabled={launching || plan.total_contacts_eligible === 0}
          className="flex-1 h-11 rounded-lg bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 disabled:opacity-60 inline-flex items-center justify-center gap-2">
          {launching ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
          {launching ? "Launching..." : "Confirm & Launch"}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function CampaignsPage() {
  const { userId, dbStatus } = useApp();
  const [campaigns, setCampaigns] = useState<DBCampaign[]>([]);
  const [connectors, setConnectors] = useState<DBConnector[]>([]);
  const [segments, setSegments] = useState<DBSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState(0);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Form state ──
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("Marketing");
  const [templateBody, setTemplateBody] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>({});
  const [selectedConnector, setSelectedConnector] = useState("");
  const [fallbackConnector, setFallbackConnector] = useState("");
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [excludeTags, setExcludeTags] = useState<string[]>(["Opted_Out", "Do_Not_Disturb"]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [cooldownHours, setCooldownHours] = useState(48);
  const [maxPerContact, setMaxPerContact] = useState(1);
  const [dailyLimit, setDailyLimit] = useState(10000);
  const [sendWindowStart, setSendWindowStart] = useState("10:00");
  const [sendWindowEnd, setSendWindowEnd] = useState("19:00");
  const [priorityMode, setPriorityMode] = useState<PriorityMode>("engagement");
  const [startDate, setStartDate] = useState("");
  const [sequenceEnabled, setSequenceEnabled] = useState(false);
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStepDef[]>([]);
  const [aiReview, setAiReview] = useState<AiReviewResult | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [plan, setPlan] = useState<CampaignPlan | null>(null);
  const [isPlanGenerating, setIsPlanGenerating] = useState(false);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [launching, setLaunching] = useState(false);

  const flash = useCallback((t: "ok" | "err", text: string) => {
    setNotice({ type: t, text });
    setTimeout(() => setNotice(null), 5000);
  }, []);

  const load = useCallback(async () => {
    if (!supabase || !userId) { setLoading(false); return; }
    const [cRes, connRes, segRes] = await Promise.all([
      supabase.from("campaigns").select("id, name, category, template_name, status, total_sent, total_delivered, created_at, launched_at, plan_generated_at").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("connectors").select("id, name, type, status, is_fallback, messaging_tier").eq("user_id", userId).eq("status", "active"),
      supabase.from("segments").select("id, name, contact_count").eq("user_id", userId),
    ]);
    if (cRes.data) setCampaigns(cRes.data);
    if (connRes.data) setConnectors(connRes.data);
    if (segRes.data) setSegments(segRes.data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Auto-fill daily limit from connector tier
  useEffect(() => {
    if (!selectedConnector) return;
    const conn = connectors.find((c) => c.id === selectedConnector);
    if (conn?.messaging_tier) {
      const limit = TIER_LIMITS[conn.messaging_tier] ?? 10000;
      setDailyLimit(Math.floor(limit * 0.8));
    }
  }, [selectedConnector, connectors]);

  // Detect template variables
  const detectedVars = (templateBody.match(/\{\{(\d+)\}\}/g) || []).map((v) => v.replace(/[{}]/g, ""));

  // Fetch audience count when segments change
  useEffect(() => {
    if (!userId || selectedSegments.length === 0) { setAudienceCount(null); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/campaigns/audience-count", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, segment_ids: selectedSegments, exclude_tags: excludeTags, category }),
        });
        const data = await res.json();
        setAudienceCount(data.count ?? null);
      } catch { setAudienceCount(null); }
    }, 500);
    return () => clearTimeout(timer);
  }, [userId, selectedSegments, excludeTags, category]);

  function reset() {
    setShowCreate(false); setStep(0); setName(""); setCategory("Marketing");
    setTemplateBody(""); setTemplateName(""); setVariableMappings({});
    setSelectedConnector(""); setFallbackConnector(""); setSelectedSegments([]);
    setExcludeTags(["Opted_Out", "Do_Not_Disturb"]); setTagFilter([]);
    setCooldownHours(48); setMaxPerContact(1); setDailyLimit(10000);
    setSendWindowStart("10:00"); setSendWindowEnd("19:00");
    setPriorityMode("engagement"); setStartDate(""); setSequenceEnabled(false);
    setSequenceSteps([]); setAiReview(null); setPlan(null); setAudienceCount(null);
  }

  async function runAiReview() {
    if (!templateBody.trim()) return;
    setIsReviewing(true);
    try {
      const res = await fetch("/api/ai/review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_body: templateBody, template_category: category }),
      });
      const r = await res.json();
      setAiReview({ score: r.score ?? 0, issues: r.issues ?? [], suggestions: r.suggestions ?? [], estimated_delivery_boost: r.estimated_delivery_boost ?? "" });
    } catch {
      setAiReview({ score: 50, issues: ["AI review unavailable"], suggestions: [], estimated_delivery_boost: "N/A" });
    }
    setIsReviewing(false);
  }

  async function generatePlan() {
    if (!userId) return;
    setIsPlanGenerating(true);
    try {
      const config: CampaignSortConfig = {
        name, category, connector_id: selectedConnector,
        fallback_connector_id: fallbackConnector || undefined,
        template_name: templateName, template_body: templateBody,
        variable_mappings: variableMappings,
        audience_segment_ids: selectedSegments, audience_tag_filter: tagFilter,
        audience_custom_filter: [], exclude_tags: excludeTags,
        cooldown_hours: cooldownHours, max_messages_per_contact: maxPerContact,
        daily_limit: dailyLimit, send_window_start: sendWindowStart, send_window_end: sendWindowEnd,
        priority_mode: priorityMode, priority_weights: PRIORITY_PRESETS[priorityMode],
        start_date: startDate || new Date().toISOString().slice(0, 10),
        sequence_steps: sequenceEnabled ? sequenceSteps : [{ step_order: 1, template_name: templateName, day_offset: 0, condition: "always" as const }],
      };
      const res = await fetch("/api/campaigns/plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, config }),
      });
      const data = await res.json();
      if (data.error) { flash("err", data.error); }
      else { setPlan(data); setStep(6); }
    } catch (err) {
      flash("err", "Failed to generate plan");
    }
    setIsPlanGenerating(false);
  }

  async function launchCampaign() {
    if (!supabase || !userId || !name.trim() || !plan) return;
    setLaunching(true);
    try {
      // Create campaign record
      const { data: newCampaign, error: insertErr } = await supabase.from("campaigns").insert({
        user_id: userId, name: name.trim(), category, template_name: templateName || null,
        connector_id: selectedConnector || null, fallback_connector_id: fallbackConnector || null,
        variable_mappings: variableMappings, audience_segment_ids: selectedSegments,
        exclude_tags: excludeTags, cooldown_hours: cooldownHours,
        max_messages_per_contact: maxPerContact, daily_limit: dailyLimit,
        send_window_start: sendWindowStart, send_window_end: sendWindowEnd,
        priority_mode: priorityMode, priority_weights: PRIORITY_PRESETS[priorityMode],
        plan_json: plan as unknown as Record<string, unknown>,
        plan_generated_at: plan.generated_at, status: "planned",
        start_date: startDate || new Date().toISOString().slice(0, 10),
      }).select("id").single();

      if (insertErr || !newCampaign) {
        flash("err", insertErr?.message || "Failed to create campaign");
        setLaunching(false);
        return;
      }

      // Save sequence steps if any
      if (sequenceEnabled && sequenceSteps.length > 0) {
        await supabase.from("campaign_sequence_steps").insert(
          sequenceSteps.map((s) => ({ campaign_id: newCampaign.id, ...s }))
        );
      }

      // Launch (write jobs)
      const launchRes = await fetch("/api/campaigns/launch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: newCampaign.id }),
      });
      const launchData = await launchRes.json();
      if (launchData.error) {
        flash("err", launchData.error);
      } else {
        flash("ok", `Campaign launched! ${launchData.total_jobs} jobs queued across ${launchData.total_days} days.`);
        reset();
        await load();
      }
    } catch {
      flash("err", "Launch failed");
    }
    setLaunching(false);
  }

  async function deleteCampaign(id: string) {
    if (!supabase) return;
    await supabase.from("campaigns").delete().eq("id", id);
    flash("ok", "Campaign deleted");
    await load();
  }

  // ── Render ─────────────────────────────────────────────────

  if (dbStatus !== "connected") {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <Info size={40} className="mx-auto text-purple-300" />
        <h1 className="text-xl font-bold">Connect Supabase First</h1>
        <p className="text-sm text-muted-foreground">Campaigns need a database connection.</p>
      </div>
    );
  }

  // ── Campaign creation wizard ───────────────────────────────

  if (showCreate) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Create Campaign</h1>
          <button onClick={reset} className="p-2 rounded-lg hover:bg-muted"><X size={20} /></button>
        </div>

        {/* Steps nav */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex items-center">
              <button onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap ${i === step ? "bg-purple-600 text-white" : i < step ? "bg-purple-50 text-purple-700" : "bg-muted text-muted-foreground"}`}>
                <s.icon size={13} /> {s.label}
              </button>
              {i < STEPS.length - 1 && <ChevronRight size={12} className="text-muted-foreground mx-0.5" />}
            </div>
          ))}
        </div>

        {notice && (
          <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium ${notice.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
            {notice.type === "ok" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {notice.text}
          </div>
        )}

        <div className="rounded-xl border bg-white shadow-sm p-6">

          {/* ─── Step 0: Details ─── */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-bold">Campaign Details</h2>
              <label className="block text-sm font-semibold">
                Name <span className="text-red-500">*</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer Sale 2026"
                  className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
              </label>
              <label className="block text-sm font-semibold">
                Category
                <select value={category} onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                  className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500">
                  <option>Marketing</option><option>Utility</option><option>Authentication</option>
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Template Name
                <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Template name from Meta"
                  className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
              </label>
              <label className="block text-sm font-semibold">
                Message Body (for AI review & variable detection)
                <textarea value={templateBody} onChange={(e) => setTemplateBody(e.target.value)} rows={4}
                  placeholder="Hi {{1}}, we have an exclusive offer for {{2}}..."
                  className="mt-1 w-full rounded-lg border p-3 text-sm outline-none focus:border-purple-500 resize-y" />
              </label>
              {detectedVars.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase">Variable Mapping</p>
                  {detectedVars.map((v) => (
                    <div key={v} className="flex items-center gap-2">
                      <span className="text-sm font-mono bg-purple-50 text-purple-700 rounded px-2 py-1 border border-purple-200">{`{{${v}}}`}</span>
                      <ArrowRight size={12} className="text-muted-foreground" />
                      <select value={variableMappings[v] || ""} onChange={(e) => setVariableMappings((p) => ({ ...p, [v]: e.target.value }))}
                        className="h-9 flex-1 rounded-lg border px-3 text-sm outline-none focus:border-purple-500">
                        <option value="">Select field...</option>
                        <option value="name">Contact Name</option>
                        <option value="phone">Phone</option>
                        <option value="tier_tag">Tier Tag</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Step 1: Connector ─── */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-bold">Select Connector</h2>
              {connectors.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed p-8 text-center">
                  <Plug size={28} className="mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No active connectors. <a href="/connectors" className="text-purple-600 font-semibold hover:underline">Add one first</a></p>
                </div>
              ) : (
                <>
                  <p className="text-xs font-bold text-muted-foreground uppercase">Primary Connector</p>
                  <div className="space-y-2">
                    {connectors.filter((c) => !c.is_fallback).map((c) => (
                      <label key={c.id}
                        className={`flex items-center justify-between rounded-lg border p-4 cursor-pointer transition ${selectedConnector === c.id ? "border-purple-500 bg-purple-50" : "border-border hover:border-purple-200"}`}>
                        <div className="flex items-center gap-3">
                          <input type="radio" name="connector" checked={selectedConnector === c.id}
                            onChange={() => setSelectedConnector(c.id)} className="size-4 accent-purple-600" />
                          <div>
                            <span className="text-sm font-semibold">{c.name}</span>
                            <p className="text-[11px] text-muted-foreground">{c.type.replace(/_/g, " ")} {c.messaging_tier ? `· ${c.messaging_tier}` : ""}</p>
                          </div>
                        </div>
                        <span className="size-2 rounded-full bg-emerald-500" />
                      </label>
                    ))}
                    {connectors.filter((c) => c.is_fallback).length === 0 && connectors.map((c) => (
                      <label key={c.id}
                        className={`flex items-center justify-between rounded-lg border p-4 cursor-pointer transition ${selectedConnector === c.id ? "border-purple-500 bg-purple-50" : "border-border hover:border-purple-200"}`}>
                        <div className="flex items-center gap-3">
                          <input type="radio" name="connector" checked={selectedConnector === c.id}
                            onChange={() => setSelectedConnector(c.id)} className="size-4 accent-purple-600" />
                          <div>
                            <span className="text-sm font-semibold">{c.name}</span>
                            <p className="text-[11px] text-muted-foreground">{c.type.replace(/_/g, " ")} {c.messaging_tier ? `· ${c.messaging_tier}` : ""}</p>
                          </div>
                        </div>
                        <span className="size-2 rounded-full bg-emerald-500" />
                      </label>
                    ))}
                  </div>
                  {connectors.some((c) => c.is_fallback) && (
                    <>
                      <p className="text-xs font-bold text-muted-foreground uppercase mt-4">Fallback Connector (optional)</p>
                      <div className="space-y-2">
                        {connectors.filter((c) => c.is_fallback).map((c) => (
                          <label key={c.id}
                            className={`flex items-center justify-between rounded-lg border p-4 cursor-pointer transition ${fallbackConnector === c.id ? "border-blue-500 bg-blue-50" : "border-border hover:border-blue-200"}`}>
                            <div className="flex items-center gap-3">
                              <input type="radio" name="fallback" checked={fallbackConnector === c.id}
                                onChange={() => setFallbackConnector(c.id)} className="size-4 accent-blue-600" />
                              <div>
                                <span className="text-sm font-semibold">{c.name}</span>
                                <p className="text-[11px] text-muted-foreground">{c.type.replace(/_/g, " ")} · Fallback</p>
                              </div>
                            </div>
                            <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">FALLBACK</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* ─── Step 2: Audience ─── */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-bold">Select Audience</h2>
              {audienceCount !== null && (
                <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 flex items-center gap-2">
                  <Users size={16} className="text-purple-600" />
                  <p className="text-sm font-semibold text-purple-700">{audienceCount.toLocaleString()} contacts match this audience</p>
                </div>
              )}
              <p className="text-xs font-bold text-muted-foreground uppercase">Segments</p>
              {segments.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed p-6 text-center">
                  <Users size={24} className="mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No segments. <a href="/database" className="text-purple-600 font-semibold hover:underline">Create one</a></p>
                </div>
              ) : segments.map((seg) => (
                <label key={seg.id}
                  className={`flex items-center justify-between rounded-lg border p-4 cursor-pointer ${selectedSegments.includes(seg.id) ? "border-purple-500 bg-purple-50" : "border-border hover:border-purple-200"}`}>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={selectedSegments.includes(seg.id)}
                      onChange={() => setSelectedSegments((p) => p.includes(seg.id) ? p.filter((x) => x !== seg.id) : [...p, seg.id])}
                      className="size-4 accent-purple-600" />
                    <span className="text-sm font-semibold">{seg.name}</span>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded-full">{seg.contact_count} contacts</span>
                </label>
              ))}
              <p className="text-xs font-bold text-muted-foreground uppercase mt-4">Exclude Tags</p>
              <div className="flex flex-wrap gap-2">
                {["Opted_Out", "Do_Not_Disturb", "Freq_Capped", "Churned_90d"].map((tag) => (
                  <button key={tag} onClick={() => setExcludeTags((p) => p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag])}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${excludeTags.includes(tag) ? "bg-red-50 text-red-700 border-red-200" : "bg-muted text-muted-foreground border-border hover:border-red-200"}`}>
                    {tag.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── Step 3: Rules ─── */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-bold">Campaign Rules</h2>

              <label className="block text-sm font-semibold">
                Start Date
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
              </label>

              <div>
                <p className="text-sm font-semibold mb-2">Cooldown Period</p>
                <div className="grid grid-cols-2 gap-2">
                  {COOLDOWN_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => setCooldownHours(opt.value)}
                      className={`rounded-lg border p-3 text-left text-xs font-semibold transition ${cooldownHours === opt.value ? "border-purple-500 bg-purple-50 text-purple-700" : "border-border hover:border-purple-200"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm font-semibold">
                  Max Messages / Contact
                  <select value={maxPerContact} onChange={(e) => setMaxPerContact(Number(e.target.value))}
                    className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500">
                    <option value={1}>1 message</option>
                    <option value={2}>2 messages</option>
                    <option value={3}>3 messages</option>
                  </select>
                </label>
                <label className="block text-sm font-semibold">
                  Daily Send Cap
                  <input type="number" value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))}
                    min={1} max={1000000}
                    className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm font-semibold">
                  Send Window Start
                  <input type="time" value={sendWindowStart} onChange={(e) => setSendWindowStart(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
                </label>
                <label className="block text-sm font-semibold">
                  Send Window End
                  <input type="time" value={sendWindowEnd} onChange={(e) => setSendWindowEnd(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
                </label>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Priority Distribution</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["engagement", "recency", "tag_priority", "round_robin"] as PriorityMode[]).map((mode) => (
                    <button key={mode} onClick={() => setPriorityMode(mode)}
                      className={`rounded-lg border p-3 text-left transition ${priorityMode === mode ? "border-purple-500 bg-purple-50" : "border-border hover:border-purple-200"}`}>
                      <p className="text-xs font-bold capitalize">{mode.replace("_", " ")}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {mode === "engagement" && "Highest engagers first"}
                        {mode === "recency" && "Most recently active first"}
                        {mode === "tag_priority" && "VIP → Regular → New"}
                        {mode === "round_robin" && "Equal distribution"}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 4: Sequence ─── */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">Message Sequence</h2>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs font-semibold text-muted-foreground">Multi-message drip</span>
                  <input type="checkbox" checked={sequenceEnabled} onChange={(e) => {
                    setSequenceEnabled(e.target.checked);
                    if (e.target.checked && sequenceSteps.length === 0) {
                      setSequenceSteps([
                        { step_order: 1, template_name: templateName || "Step 1", day_offset: 0, condition: "always" },
                        { step_order: 2, template_name: "", day_offset: 2, condition: "not_replied" },
                      ]);
                    }
                  }} className="size-4 accent-purple-600" />
                </label>
              </div>

              {!sequenceEnabled ? (
                <div className="rounded-lg border-2 border-dashed p-8 text-center">
                  <Layers size={28} className="mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Single message campaign. Enable multi-message drip to add follow-ups.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sequenceSteps.map((s, i) => (
                    <div key={i} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-purple-600">STEP {s.step_order}</p>
                        {i > 0 && (
                          <button onClick={() => setSequenceSteps((p) => p.filter((_, j) => j !== i))}
                            className="text-muted-foreground hover:text-red-600"><X size={14} /></button>
                        )}
                      </div>
                      <input value={s.template_name} placeholder="Template name"
                        onChange={(e) => setSequenceSteps((p) => p.map((x, j) => j === i ? { ...x, template_name: e.target.value } : x))}
                        className="h-9 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs font-semibold">
                          Day Offset
                          <input type="number" value={s.day_offset} min={0} max={30}
                            onChange={(e) => setSequenceSteps((p) => p.map((x, j) => j === i ? { ...x, day_offset: Number(e.target.value) } : x))}
                            className="mt-1 h-9 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
                        </label>
                        <label className="text-xs font-semibold">
                          Condition
                          <select value={s.condition}
                            onChange={(e) => setSequenceSteps((p) => p.map((x, j) => j === i ? { ...x, condition: e.target.value as SequenceCondition } : x))}
                            className="mt-1 h-9 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500">
                            <option value="always">Always send</option>
                            <option value="not_replied">If not replied</option>
                            <option value="not_clicked">If not clicked</option>
                            <option value="not_converted">If not converted</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  ))}
                  {sequenceSteps.length < 5 && (
                    <button onClick={() => setSequenceSteps((p) => [...p, {
                      step_order: p.length + 1, template_name: "", day_offset: (p[p.length - 1]?.day_offset || 0) + 2, condition: "not_replied" as const,
                    }])}
                      className="w-full rounded-lg border-2 border-dashed p-3 text-xs font-semibold text-purple-600 hover:bg-purple-50">
                      + Add Follow-up Step
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── Step 5: AI Review ─── */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">AI Content Review</h2>
                <button onClick={runAiReview} disabled={isReviewing || !templateBody.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60">
                  {isReviewing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {isReviewing ? "Analyzing..." : "Run Review"}
                </button>
              </div>
              {templateBody && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">PREVIEW</p>
                  <p className="text-sm">{templateBody}</p>
                </div>
              )}
              {aiReview && (
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="rounded-lg bg-purple-50 border border-purple-200 px-4 py-3 text-center">
                      <p className="text-[10px] font-bold text-purple-600">SCORE</p>
                      <p className="text-2xl font-bold text-purple-700">{aiReview.score}</p>
                    </div>
                    <div className="flex-1 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                      <p className="text-[10px] font-bold text-emerald-700">BOOST</p>
                      <p className="text-sm font-semibold text-emerald-700">{aiReview.estimated_delivery_boost}</p>
                    </div>
                  </div>
                  {aiReview.issues.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-[10px] font-bold text-red-700 mb-1"><AlertTriangle size={10} className="inline" /> ISSUES</p>
                      {aiReview.issues.map((s, i) => <p key={i} className="text-xs text-red-700 mt-1">• {s}</p>)}
                    </div>
                  )}
                  {aiReview.suggestions.length > 0 && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <p className="text-[10px] font-bold text-blue-700 mb-1"><Lightbulb size={10} className="inline" /> SUGGESTIONS</p>
                      {aiReview.suggestions.map((s, i) => <p key={i} className="text-xs text-blue-700 mt-1">• {s}</p>)}
                    </div>
                  )}
                </div>
              )}
              {!aiReview && !templateBody.trim() && (
                <p className="text-sm text-muted-foreground text-center py-6">Add a message body in Step 1 to review.</p>
              )}
            </div>
          )}

          {/* ─── Step 6: Plan ─── */}
          {step === 6 && (
            <div className="space-y-4">
              {!plan ? (
                <div className="text-center py-8 space-y-4">
                  <BarChart3 size={40} className="mx-auto text-purple-300" />
                  <h2 className="font-bold">Generate Distribution Plan</h2>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    The planner will analyze your audience, apply eligibility filters, compute priority scores,
                    and distribute contacts across days and hours.
                  </p>
                  <button onClick={generatePlan} disabled={isPlanGenerating}
                    className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60">
                    {isPlanGenerating ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                    {isPlanGenerating ? "Generating Plan..." : "Generate Plan"}
                  </button>
                </div>
              ) : (
                <PlanReviewUI plan={plan} onEdit={() => setStep(3)} onLaunch={launchCampaign} launching={launching} />
              )}
            </div>
          )}

          {/* ─── Step 7: Launch ─── */}
          {step === 7 && (
            <div className="space-y-4">
              <h2 className="font-bold">Review & Launch</h2>
              {[
                ["Campaign", name],
                ["Category", category],
                ["Template", templateName || "—"],
                ["Connector", connectors.find((c) => c.id === selectedConnector)?.name || "—"],
                ["Fallback", connectors.find((c) => c.id === fallbackConnector)?.name || "None"],
                ["AI Score", aiReview ? String(aiReview.score) : "Not reviewed"],
                ["Audience", `${selectedSegments.length} segment(s)${audienceCount !== null ? ` · ${audienceCount.toLocaleString()} contacts` : ""}`],
                ["Cooldown", `${cooldownHours} hours`],
                ["Daily Cap", dailyLimit.toLocaleString()],
                ["Send Window", `${sendWindowStart} – ${sendWindowEnd}`],
                ["Priority", priorityMode.replace("_", " ")],
                ["Start Date", startDate || "Today"],
                ["Sequence", sequenceEnabled ? `${sequenceSteps.length} steps` : "Single message"],
                ["Plan", plan ? `${plan.total_contacts_eligible.toLocaleString()} eligible · ${plan.estimated_days_to_complete} days` : "Not generated"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between rounded-lg border p-3 text-sm">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
              {!plan && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-600" />
                  <p className="text-xs text-amber-800">Generate a plan in the previous step before launching.</p>
                </div>
              )}
              <button onClick={launchCampaign} disabled={launching || !name.trim() || !plan}
                className="w-full h-11 rounded-lg bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 disabled:opacity-60 inline-flex items-center justify-center gap-2">
                {launching ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {launching ? "Launching..." : "Launch Campaign"}
              </button>
            </div>
          )}

          {/* ─── Navigation ─── */}
          <div className="flex justify-between mt-6 pt-4 border-t">
            <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
              className="inline-flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-40">
              <ChevronLeft size={14} /> Back
            </button>
            {step < 7 && step !== 6 && (
              <button onClick={() => setStep(step + 1)}
                className="inline-flex items-center gap-1 rounded-lg bg-foreground text-background px-4 py-2 text-sm font-semibold hover:bg-foreground/90">
                Next <ChevronRight size={14} />
              </button>
            )}
            {step === 6 && !plan && (
              <button onClick={generatePlan} disabled={isPlanGenerating}
                className="inline-flex items-center gap-1 rounded-lg bg-purple-600 text-white px-4 py-2 text-sm font-semibold hover:bg-purple-700 disabled:opacity-60">
                {isPlanGenerating ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                Generate Plan
              </button>
            )}
            {step === 6 && plan && (
              <button onClick={() => setStep(7)}
                className="inline-flex items-center gap-1 rounded-lg bg-foreground text-background px-4 py-2 text-sm font-semibold hover:bg-foreground/90">
                Next <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Campaign list ──────────────────────────────────────────

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Create, manage, and track WhatsApp campaigns with intelligent scheduling.</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700">
          <Plus size={16} /> Create Campaign
        </button>
      </div>

      {notice && (
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium ${notice.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
          {notice.type === "ok" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {notice.text}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-purple-400" /></div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed bg-white p-12 text-center">
          <Send size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <h3 className="font-bold">No campaigns yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Create your first campaign with intelligent scheduling and batch distribution.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Name</th>
                <th className="px-5 py-3 text-left">Category</th>
                <th className="px-5 py-3 text-right">Delivery %</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Created</th>
                <th className="px-5 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {campaigns.map((c) => {
                const pct = c.total_sent > 0 ? ((c.total_delivered / c.total_sent) * 100).toFixed(1) : "—";
                return (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-5 py-4">
                      <a href={`/campaigns/${c.id}`} className="font-semibold hover:text-purple-600">{c.name}</a>
                      {c.template_name && <p className="text-xs text-muted-foreground">{c.template_name}</p>}
                    </td>
                    <td className="px-5 py-4">{catBadge(c.category)}</td>
                    <td className="px-5 py-4 text-right font-bold">{pct}{pct !== "—" && "%"}</td>
                    <td className="px-5 py-4 text-center">{statusBadge(c.status)}</td>
                    <td className="px-5 py-4 text-right text-muted-foreground">{new Date(c.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</td>
                    <td className="px-5 py-4 flex gap-1 justify-end">
                      <a href={`/campaigns/${c.id}`} className="p-1 rounded hover:bg-purple-50 text-muted-foreground hover:text-purple-600">
                        <Eye size={14} />
                      </a>
                      <button onClick={() => deleteCampaign(c.id)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
