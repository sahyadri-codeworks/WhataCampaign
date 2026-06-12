"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, ChevronRight, ChevronLeft, Sparkles, Loader2, CheckCircle2, X, Search, Clock,
  Send, FileText, Users, Calendar, Eye, Lightbulb, AlertTriangle, Trash2, Info, Plug,
} from "lucide-react";
import { useApp } from "@/lib/AppContext";
import { supabase } from "@/lib/supabase";
import type { TemplateCategory, AiReviewResult } from "@/lib/types";

type DBCampaign = {
  id: string; name: string; category: string; template_name: string | null;
  status: string; total_sent: number; total_delivered: number; created_at: string;
};

type DBConnector = { id: string; name: string; type: string; status: string; is_fallback: boolean };
type DBSegment = { id: string; name: string; contact_count: number };

const STEPS = [
  { label: "Details", icon: FileText },
  { label: "Connector", icon: Plug },
  { label: "AI Review", icon: Sparkles },
  { label: "Audience", icon: Users },
  { label: "Schedule", icon: Calendar },
  { label: "Launch", icon: Eye },
];

function statusBadge(s: string) {
  const m: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600", scheduled: "bg-blue-50 text-blue-700",
    sending: "bg-purple-50 text-purple-700", completed: "bg-emerald-50 text-emerald-700", paused: "bg-amber-50 text-amber-700",
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

  // Form
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("Marketing");
  const [templateBody, setTemplateBody] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [selectedConnector, setSelectedConnector] = useState("");
  const [aiReview, setAiReview] = useState<AiReviewResult | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [scheduleType, setScheduleType] = useState<"immediate" | "scheduled">("immediate");
  const [scheduledAt, setScheduledAt] = useState("");

  const flash = useCallback((t: "ok" | "err", text: string) => {
    setNotice({ type: t, text });
    setTimeout(() => setNotice(null), 4000);
  }, []);

  const load = useCallback(async () => {
    if (!supabase || !userId) { setLoading(false); return; }
    const [cRes, connRes, segRes] = await Promise.all([
      supabase.from("campaigns").select("id, name, category, template_name, status, total_sent, total_delivered, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("connectors").select("id, name, type, status, is_fallback").eq("user_id", userId).eq("status", "active"),
      supabase.from("segments").select("id, name, contact_count").eq("user_id", userId),
    ]);
    if (cRes.data) setCampaigns(cRes.data);
    if (connRes.data) setConnectors(connRes.data);
    if (segRes.data) setSegments(segRes.data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  function reset() {
    setShowCreate(false); setStep(0); setName(""); setCategory("Marketing");
    setTemplateBody(""); setTemplateName(""); setSelectedConnector(""); setAiReview(null);
    setSelectedSegments([]); setScheduleType("immediate"); setScheduledAt("");
  }

  async function runAiReview() {
    if (!templateBody.trim()) return;
    setIsReviewing(true);
    try {
      const res = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_body: templateBody, template_category: category }),
      });
      const r = await res.json();
      setAiReview({ score: r.score ?? 0, issues: r.issues ?? [], suggestions: r.suggestions ?? [], estimated_delivery_boost: r.estimated_delivery_boost ?? "" });
    } catch {
      setAiReview({ score: 50, issues: ["AI review unavailable"], suggestions: [], estimated_delivery_boost: "N/A" });
    }
    setIsReviewing(false);
  }

  async function launchCampaign() {
    if (!supabase || !userId || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("campaigns").insert({
      user_id: userId,
      name: name.trim(),
      category,
      template_name: templateName || null,
      status: scheduleType === "immediate" ? "sending" : "scheduled",
      scheduled_at: scheduleType === "scheduled" ? scheduledAt : null,
    });
    if (error) {
      flash("err", error.message);
    } else {
      flash("ok", "Campaign created!");
      reset();
      await load();
    }
    setSaving(false);
  }

  async function deleteCampaign(id: string) {
    if (!supabase) return;
    await supabase.from("campaigns").delete().eq("id", id);
    flash("ok", "Campaign deleted");
    await load();
  }

  if (dbStatus !== "connected") {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <Info size={40} className="mx-auto text-purple-300" />
        <h1 className="text-xl font-bold">Connect Supabase First</h1>
        <p className="text-sm text-muted-foreground">Campaigns need a database connection.</p>
      </div>
    );
  }

  if (showCreate) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Create Campaign</h1>
          <button onClick={reset} className="p-2 rounded-lg hover:bg-muted"><X size={20} /></button>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex items-center">
              <button onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${i === step ? "bg-purple-600 text-white" : i < step ? "bg-purple-50 text-purple-700" : "bg-muted text-muted-foreground"}`}>
                <s.icon size={13} /> {s.label}
              </button>
              {i < STEPS.length - 1 && <ChevronRight size={12} className="text-muted-foreground mx-0.5" />}
            </div>
          ))}
        </div>

        <div className="rounded-xl border bg-white shadow-sm p-6">
          {/* Step 0: Details */}
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
                Message Body (for AI review)
                <textarea value={templateBody} onChange={(e) => setTemplateBody(e.target.value)} rows={4}
                  placeholder="Hi {{1}}, we have an exclusive offer..."
                  className="mt-1 w-full rounded-lg border p-3 text-sm outline-none focus:border-purple-500 resize-y" />
              </label>
            </div>
          )}

          {/* Step 1: Connector */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-bold">Select Connector</h2>
              <p className="text-sm text-muted-foreground">Choose which WhatsApp provider to send through. Fallback connectors auto-retry on rate limit.</p>
              {connectors.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed p-8 text-center">
                  <Plug size={28} className="mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No active connectors. <a href="/connectors" className="text-purple-600 font-semibold hover:underline">Add one first</a></p>
                </div>
              ) : (
                <div className="space-y-2">
                  {connectors.map((c) => (
                    <label key={c.id}
                      className={`flex items-center justify-between rounded-lg border p-4 cursor-pointer transition ${selectedConnector === c.id ? "border-purple-500 bg-purple-50" : "border-border hover:border-purple-200"}`}>
                      <div className="flex items-center gap-3">
                        <input type="radio" name="connector" checked={selectedConnector === c.id}
                          onChange={() => setSelectedConnector(c.id)} className="size-4 accent-purple-600" />
                        <div>
                          <span className="text-sm font-semibold">{c.name}</span>
                          <p className="text-[11px] text-muted-foreground">{c.type.replace("_", " ")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.is_fallback && <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">FALLBACK</span>}
                        <span className="size-2 rounded-full bg-emerald-500" />
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: AI Review */}
          {step === 2 && (
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

          {/* Step 3: Audience */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-bold">Select Audience</h2>
              {segments.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed p-8 text-center">
                  <Users size={28} className="mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No segments. <a href="/database" className="text-purple-600 font-semibold hover:underline">Create one in Database</a></p>
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
            </div>
          )}

          {/* Step 4: Schedule */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-bold">When to Send?</h2>
              <div className="flex gap-3">
                {[
                  { val: "immediate" as const, icon: Send, label: "Send Now", desc: "Start sending immediately" },
                  { val: "scheduled" as const, icon: Clock, label: "Schedule", desc: "Pick a date & time" },
                ].map((opt) => (
                  <button key={opt.val} onClick={() => setScheduleType(opt.val)}
                    className={`flex-1 rounded-lg border p-4 text-left ${scheduleType === opt.val ? "border-purple-500 bg-purple-50" : "border-border hover:border-purple-200"}`}>
                    <opt.icon size={20} className="mb-2 text-purple-600" />
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                  </button>
                ))}
              </div>
              {scheduleType === "scheduled" && (
                <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
                  className="h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
              )}
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div className="space-y-4">
              <h2 className="font-bold">Review & Launch</h2>
              {[
                ["Campaign", name],
                ["Category", category],
                ["Template", templateName || "—"],
                ["Connector", connectors.find((c) => c.id === selectedConnector)?.name || "—"],
                ["AI Score", aiReview ? String(aiReview.score) : "Not reviewed"],
                ["Audience", `${selectedSegments.length} segment(s)`],
                ["Schedule", scheduleType === "immediate" ? "Send now" : scheduledAt || "Not set"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between rounded-lg border p-3 text-sm">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
              <button onClick={launchCampaign} disabled={saving || !name.trim()}
                className="w-full h-11 rounded-lg bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 disabled:opacity-60 inline-flex items-center justify-center gap-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {saving ? "Creating..." : "Launch Campaign"}
              </button>
            </div>
          )}

          {/* Nav */}
          <div className="flex justify-between mt-6 pt-4 border-t">
            <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
              className="inline-flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-40">
              <ChevronLeft size={14} /> Back
            </button>
            {step < 5 && (
              <button onClick={() => setStep(step + 1)}
                className="inline-flex items-center gap-1 rounded-lg bg-foreground text-background px-4 py-2 text-sm font-semibold hover:bg-foreground/90">
                Next <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Create, manage, and track WhatsApp campaigns.</p>
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
          <p className="text-sm text-muted-foreground mt-1">Create your first campaign to start sending WhatsApp messages.</p>
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
                <th className="px-5 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {campaigns.map((c) => {
                const pct = c.total_sent > 0 ? ((c.total_delivered / c.total_sent) * 100).toFixed(1) : "—";
                return (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-5 py-4">
                      <p className="font-semibold">{c.name}</p>
                      {c.template_name && <p className="text-xs text-muted-foreground">{c.template_name}</p>}
                    </td>
                    <td className="px-5 py-4">{catBadge(c.category)}</td>
                    <td className="px-5 py-4 text-right font-bold">{pct}{pct !== "—" && "%"}</td>
                    <td className="px-5 py-4 text-center">{statusBadge(c.status)}</td>
                    <td className="px-5 py-4 text-right text-muted-foreground">{new Date(c.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</td>
                    <td className="px-5 py-4">
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
