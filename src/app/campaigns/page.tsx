"use client";

import { useState } from "react";
import {
  Plus,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Loader2,
  CheckCircle2,
  X,
  Search,
  Clock,
  Send,
  FileText,
  Users,
  Calendar,
  Eye,
  Lightbulb,
  AlertTriangle,
} from "lucide-react";
import type { Campaign, TemplateCategory, AiReviewResult, MessageTemplate } from "@/lib/types";

const mockTemplates: MessageTemplate[] = [
  { id: "t1", name: "welcome_msg", category: "Utility", body: "Hi {{1}}, welcome to {{2}}! We're glad to have you on board.", language: "en", status: "APPROVED" },
  { id: "t2", name: "promo_june", category: "Marketing", body: "Hi {{1}}, exclusive offer just for you! Get {{2}} off on your next purchase. Limited time only!", language: "en", status: "APPROVED" },
  { id: "t3", name: "order_confirm", category: "Utility", body: "Your order #{{1}} has been confirmed. Delivery expected by {{2}}.", language: "en", status: "APPROVED" },
  { id: "t4", name: "otp_verify", category: "Authentication", body: "Your verification code is {{1}}. Do not share this with anyone.", language: "en", status: "APPROVED" },
  { id: "t5", name: "feedback_request", category: "Marketing", body: "Hi {{1}}, we'd love your feedback on your recent experience. Reply with a rating 1-5.", language: "en", status: "PENDING" },
  { id: "t6", name: "reengagement", category: "Marketing", body: "Hey {{1}}, we miss you! Come back and check out what's new. Use code {{2}} for a special discount.", language: "en", status: "APPROVED" },
];

const mockCampaigns: Campaign[] = [
  { id: "c1", name: "June Retention", category: "Marketing", template_id: "t2", template_name: "promo_june", status: "completed", delivery_pct: 94.2, created_at: "2026-06-01", total_sent: 5200, total_delivered: 4898, total_read: 3200, total_responded: 840, total_failed: 302 },
  { id: "c2", name: "Welcome Flow", category: "Utility", template_id: "t1", template_name: "welcome_msg", status: "completed", delivery_pct: 97.8, created_at: "2026-06-03", total_sent: 3100, total_delivered: 3032, total_read: 2100, total_responded: 520, total_failed: 68 },
  { id: "c3", name: "Re-engage VIP", category: "Marketing", template_id: "t6", template_name: "reengagement", status: "sending", delivery_pct: 88.4, created_at: "2026-06-08", total_sent: 4800, total_delivered: 4243, total_read: 0, total_responded: 0, total_failed: 557 },
  { id: "c4", name: "Flash Sale Blast", category: "Marketing", template_id: "t2", template_name: "promo_june", status: "paused", delivery_pct: 72.1, created_at: "2026-06-10", total_sent: 6200, total_delivered: 4470, total_read: 1200, total_responded: 310, total_failed: 1730 },
  { id: "c5", name: "OTP Service", category: "Authentication", template_id: "t4", template_name: "otp_verify", status: "completed", delivery_pct: 99.1, created_at: "2026-06-11", total_sent: 1200, total_delivered: 1189, total_read: 1189, total_responded: 0, total_failed: 11 },
];

const mockSegments = [
  { id: "s1", name: "VIP Customers", count: 1240 },
  { id: "s2", name: "Marketing Opt-in", count: 8340 },
  { id: "s3", name: "New Users (7d)", count: 432 },
  { id: "s4", name: "Inactive 30d+", count: 2100 },
];

function statusBadge(status: Campaign["status"]) {
  const map = {
    draft: "bg-gray-100 text-gray-600 border-gray-200",
    scheduled: "bg-blue-50 text-blue-700 border-blue-200",
    sending: "bg-purple-50 text-purple-700 border-purple-200",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    paused: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold capitalize ${map[status]}`}>
      {status}
    </span>
  );
}

function categoryBadge(cat: TemplateCategory) {
  const map = {
    Marketing: "bg-purple-50 text-purple-700 border-purple-200",
    Utility: "bg-blue-50 text-blue-700 border-blue-200",
    Authentication: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${map[cat]}`}>
      {cat}
    </span>
  );
}

const steps = [
  { label: "Details", icon: FileText },
  { label: "AI Review", icon: Sparkles },
  { label: "Audience", icon: Users },
  { label: "Schedule", icon: Calendar },
  { label: "Review", icon: Eye },
];

export default function CampaignsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState(0);
  const [campaignName, setCampaignName] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("Marketing");
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [aiReview, setAiReview] = useState<AiReviewResult | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [scheduleType, setScheduleType] = useState<"immediate" | "scheduled">("immediate");
  const [scheduledDate, setScheduledDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  function resetCreate() {
    setShowCreate(false);
    setStep(0);
    setCampaignName("");
    setCategory("Marketing");
    setSelectedTemplate(null);
    setAiReview(null);
    setSelectedSegments([]);
    setScheduleType("immediate");
    setScheduledDate("");
  }

  async function runAiReview() {
    if (!selectedTemplate) return;
    setIsReviewing(true);
    try {
      const res = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_body: selectedTemplate.body,
          template_category: category,
        }),
      });
      const result = await res.json();
      setAiReview({
        score: result.score ?? 0,
        issues: result.issues ?? [],
        suggestions: result.suggestions ?? [],
        estimated_delivery_boost: result.estimated_delivery_boost ?? "Unknown",
      });
    } catch {
      setAiReview({
        score: 50,
        issues: ["Could not reach AI review service"],
        suggestions: ["Check your API configuration"],
        estimated_delivery_boost: "N/A",
      });
    }
    setIsReviewing(false);
  }

  const filteredTemplates = mockTemplates.filter(
    (t) => t.category === category && t.name.includes(searchQuery.toLowerCase())
  );

  if (showCreate) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Create Campaign</h1>
          <button onClick={resetCreate} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center">
              <button
                onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  i === step
                    ? "bg-purple-600 text-white"
                    : i < step
                      ? "bg-purple-50 text-purple-700 cursor-pointer"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                <s.icon size={14} />
                {s.label}
              </button>
              {i < steps.length - 1 && <ChevronRight size={14} className="text-muted-foreground mx-1 shrink-0" />}
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-white shadow-sm p-6">
          {/* Step 1: Details */}
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold">Campaign Details</h2>
              <label className="block text-sm font-semibold">
                Campaign Name
                <input
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g., Summer Sale 2026"
                  className="mt-1.5 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </label>
              <label className="block text-sm font-semibold">
                Category
                <select
                  value={category}
                  onChange={(e) => { setCategory(e.target.value as TemplateCategory); setSelectedTemplate(null); }}
                  className="mt-1.5 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                >
                  <option>Marketing</option>
                  <option>Utility</option>
                  <option>Authentication</option>
                </select>
              </label>
              <div>
                <label className="block text-sm font-semibold mb-2">Select Template</label>
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search templates..."
                    className="h-9 w-full rounded-lg border border-border bg-muted/30 pl-8 pr-3 text-sm outline-none focus:border-purple-500"
                  />
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {filteredTemplates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t)}
                      className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
                        selectedTemplate?.id === t.id
                          ? "border-purple-500 bg-purple-50"
                          : "border-border hover:border-purple-200 hover:bg-purple-50/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{t.name}</span>
                        <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                          t.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}>
                          {t.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.body}</p>
                    </button>
                  ))}
                  {filteredTemplates.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No templates found for this category.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: AI Review */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">AI Content Review</h2>
                <button
                  onClick={runAiReview}
                  disabled={isReviewing}
                  className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-60"
                >
                  {isReviewing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {isReviewing ? "Analyzing..." : "Run AI Review"}
                </button>
              </div>

              {selectedTemplate && (
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Template Preview</p>
                  <p className="text-sm leading-relaxed">{selectedTemplate.body}</p>
                </div>
              )}

              {aiReview && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-purple-50 border border-purple-200 px-4 py-3 text-center">
                      <p className="text-xs font-bold text-purple-600">SCORE</p>
                      <p className="text-3xl font-bold text-purple-700">{aiReview.score}</p>
                    </div>
                    <div className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-xs font-bold text-emerald-700">ESTIMATED BOOST</p>
                      <p className="text-sm font-semibold text-emerald-700 mt-1">{aiReview.estimated_delivery_boost}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="text-xs font-bold text-red-700 mb-2 flex items-center gap-1"><AlertTriangle size={12} /> ISSUES</p>
                    <ul className="space-y-1.5">
                      {aiReview.issues.map((issue, i) => (
                        <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                          <span className="mt-1 size-1.5 rounded-full bg-red-400 shrink-0" />
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1"><Lightbulb size={12} /> SUGGESTIONS</p>
                    <ul className="space-y-1.5">
                      {aiReview.suggestions.map((s, i) => (
                        <li key={i} className="text-sm text-blue-700 flex items-start gap-2">
                          <span className="mt-1 size-1.5 rounded-full bg-blue-400 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Audience */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold">Select Audience</h2>
              <p className="text-sm text-muted-foreground">Pick segments from your Database or upload a CSV.</p>
              <div className="space-y-2">
                {mockSegments.map((seg) => (
                  <label
                    key={seg.id}
                    className={`flex items-center justify-between rounded-lg border p-4 cursor-pointer transition-colors ${
                      selectedSegments.includes(seg.id)
                        ? "border-purple-500 bg-purple-50"
                        : "border-border hover:border-purple-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedSegments.includes(seg.id)}
                        onChange={() => {
                          setSelectedSegments((prev) =>
                            prev.includes(seg.id) ? prev.filter((id) => id !== seg.id) : [...prev, seg.id]
                          );
                        }}
                        className="size-4 rounded border-border accent-purple-600"
                      />
                      <span className="text-sm font-semibold">{seg.name}</span>
                    </div>
                    <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded-full">
                      {seg.count.toLocaleString()} contacts
                    </span>
                  </label>
                ))}
              </div>
              <div className="text-center pt-2">
                <button className="text-sm font-semibold text-purple-600 hover:text-purple-700">
                  + Upload CSV instead
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Schedule */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold">Schedule</h2>
              <div className="flex gap-3">
                <button
                  onClick={() => setScheduleType("immediate")}
                  className={`flex-1 rounded-lg border p-4 text-sm font-semibold transition-colors ${
                    scheduleType === "immediate" ? "border-purple-500 bg-purple-50 text-purple-700" : "border-border hover:border-purple-200"
                  }`}
                >
                  <Send size={20} className="mx-auto mb-2" />
                  Send Immediately
                </button>
                <button
                  onClick={() => setScheduleType("scheduled")}
                  className={`flex-1 rounded-lg border p-4 text-sm font-semibold transition-colors ${
                    scheduleType === "scheduled" ? "border-purple-500 bg-purple-50 text-purple-700" : "border-border hover:border-purple-200"
                  }`}
                >
                  <Clock size={20} className="mx-auto mb-2" />
                  Schedule for Later
                </button>
              </div>
              {scheduleType === "scheduled" && (
                <input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              )}
            </div>
          )}

          {/* Step 5: Review */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold">Review & Launch</h2>
              <div className="space-y-3">
                <div className="rounded-lg border border-border p-4 flex justify-between">
                  <span className="text-sm text-muted-foreground">Campaign Name</span>
                  <span className="text-sm font-semibold">{campaignName || "—"}</span>
                </div>
                <div className="rounded-lg border border-border p-4 flex justify-between">
                  <span className="text-sm text-muted-foreground">Category</span>
                  {categoryBadge(category)}
                </div>
                <div className="rounded-lg border border-border p-4 flex justify-between">
                  <span className="text-sm text-muted-foreground">Template</span>
                  <span className="text-sm font-semibold">{selectedTemplate?.name || "—"}</span>
                </div>
                <div className="rounded-lg border border-border p-4 flex justify-between">
                  <span className="text-sm text-muted-foreground">AI Score</span>
                  <span className="text-sm font-bold text-purple-600">{aiReview?.score ?? "Not reviewed"}</span>
                </div>
                <div className="rounded-lg border border-border p-4 flex justify-between">
                  <span className="text-sm text-muted-foreground">Audience</span>
                  <span className="text-sm font-semibold">{selectedSegments.length} segment(s)</span>
                </div>
                <div className="rounded-lg border border-border p-4 flex justify-between">
                  <span className="text-sm text-muted-foreground">Schedule</span>
                  <span className="text-sm font-semibold capitalize">{scheduleType === "immediate" ? "Send now" : scheduledDate || "Not set"}</span>
                </div>
              </div>
              <button
                onClick={resetCreate}
                className="w-full h-11 rounded-lg bg-purple-600 text-white font-semibold text-sm transition hover:bg-purple-700"
              >
                Launch Campaign
              </button>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6 pt-4 border-t border-border">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Back
            </button>
            {step < 4 && (
              <button
                onClick={() => setStep(Math.min(4, step + 1))}
                className="inline-flex items-center gap-1 rounded-lg bg-foreground text-background px-4 py-2 text-sm font-semibold transition hover:bg-foreground/90"
              >
                Next <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage and create WhatsApp campaigns.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700"
        >
          <Plus size={16} /> Create Campaign
        </button>
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground text-xs uppercase">
            <tr>
              <th className="px-5 py-3 text-left">Name</th>
              <th className="px-5 py-3 text-left">Category</th>
              <th className="px-5 py-3 text-right">Delivery %</th>
              <th className="px-5 py-3 text-center">Status</th>
              <th className="px-5 py-3 text-right">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {mockCampaigns.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                <td className="px-5 py-4">
                  <p className="font-semibold text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.template_name}</p>
                </td>
                <td className="px-5 py-4">{categoryBadge(c.category)}</td>
                <td className="px-5 py-4 text-right">
                  <span className={`font-bold ${c.delivery_pct >= 90 ? "text-emerald-600" : c.delivery_pct >= 75 ? "text-amber-600" : "text-red-600"}`}>
                    {c.delivery_pct}%
                  </span>
                </td>
                <td className="px-5 py-4 text-center">{statusBadge(c.status)}</td>
                <td className="px-5 py-4 text-right text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
