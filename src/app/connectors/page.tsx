"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, X, AlertTriangle, Plug, Settings2, Activity, Wifi, WifiOff, ExternalLink,
  RefreshCw, Shield, Zap, Globe, Loader2, CheckCircle2, XCircle, Save, Trash2, Info,
} from "lucide-react";
import { useApp } from "@/lib/AppContext";
import { supabase } from "@/lib/supabase";
import type { ConnectorType, QualityRating } from "@/lib/types";

type StoredConnector = {
  id: string;
  name: string;
  type: string;
  status: string;
  is_fallback: boolean;
  config_encrypted: Record<string, string>;
  last_successful_send: string | null;
  error_rate_24h: number;
  messaging_tier: string | null;
  quality_rating: string | null;
};

const TYPE_META: Record<string, { label: string; icon: typeof Plug; hint: string }> = {
  meta_cloud_api: { label: "Meta Cloud API", icon: Zap, hint: "Official WhatsApp Business API via Meta" },
  "360dialog": { label: "360dialog", icon: Globe, hint: "BSP partner — 360dialog" },
  wati: { label: "Wati", icon: Globe, hint: "BSP partner — Wati" },
  interakt: { label: "Interakt", icon: Globe, hint: "BSP partner — Interakt" },
  crm_webhook: { label: "CRM Webhook", icon: ExternalLink, hint: "Outbound webhook to your CRM" },
};

function QualityDot({ rating }: { rating?: string | null }) {
  if (!rating) return null;
  const c = { GREEN: "bg-emerald-500", YELLOW: "bg-amber-500", RED: "bg-red-500" }[rating] ?? "bg-gray-400";
  return <span className={`size-2.5 rounded-full ${c}`} />;
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { icon: typeof Wifi; cls: string }> = {
    active: { icon: Wifi, cls: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    inactive: { icon: WifiOff, cls: "text-gray-500 bg-gray-50 border-gray-200" },
    error: { icon: AlertTriangle, cls: "text-red-600 bg-red-50 border-red-200" },
  };
  const cfg = m[status] ?? m.inactive;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${cfg.cls}`}>
      <cfg.icon size={10} /> {status}
    </span>
  );
}

export default function ConnectorsPage() {
  const { userId, dbStatus } = useApp();
  const [connectors, setConnectors] = useState<StoredConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState<ConnectorType>("meta_cloud_api");
  const [newName, setNewName] = useState("");
  const [newConfig, setNewConfig] = useState<Record<string, string>>({});
  const [isFallback, setIsFallback] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const [selectedConn, setSelectedConn] = useState<StoredConnector | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const flash = useCallback((type: "ok" | "err", text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4000);
  }, []);

  const load = useCallback(async () => {
    if (!supabase || !userId) { setLoading(false); return; }
    const { data } = await supabase
      .from("connectors")
      .select("id, name, type, status, is_fallback, config_encrypted, last_successful_send, error_rate_24h, messaging_tier, quality_rating")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (data) setConnectors(data.map((d) => ({ ...d, config_encrypted: (d.config_encrypted ?? {}) as Record<string, string> })));
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  function updateCfg(k: string, v: string) { setNewConfig((p) => ({ ...p, [k]: v })); }

  async function addConnector() {
    if (!supabase || !userId || !newName.trim()) return;
    setSaving(true);

    let status = "inactive";
    const cfg = { ...newConfig };

    // Test connection
    try {
      const res = await fetch("/api/connectors/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: newType, config: newConfig }),
      });
      const r = await res.json();
      if (r.ok) {
        status = "active";
        if (r.display_name) cfg.display_name = r.display_name;
        if (r.phone_number) cfg.display_phone = r.phone_number;
      } else {
        status = "error";
      }
    } catch { status = "inactive"; }

    // Fetch quality for Meta
    let qr: string | null = null;
    let tier: string | null = null;
    if (newType === "meta_cloud_api" && status === "active" && newConfig.phone_number_id) {
      try {
        const res = await fetch("/api/connectors/quality", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone_number_id: newConfig.phone_number_id, access_token: newConfig.access_token }),
        });
        const d = await res.json();
        qr = d.quality_rating ?? null;
        tier = d.messaging_limit_tier ?? null;
      } catch {}
    }

    const { error } = await supabase.from("connectors").insert({
      user_id: userId,
      name: newName.trim(),
      type: newType,
      status,
      is_fallback: isFallback,
      config_encrypted: cfg as any,
      quality_rating: qr,
      messaging_tier: tier,
    });

    if (error) {
      flash("err", error.message);
    } else {
      flash("ok", `Connector added (${status})`);
      setShowAdd(false);
      setNewName(""); setNewConfig({}); setNewType("meta_cloud_api"); setIsFallback(false);
      await load();
    }
    setSaving(false);
  }

  async function testConnection(c: StoredConnector) {
    setTestingId(c.id);
    setTestResult(null);
    try {
      const res = await fetch("/api/connectors/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: c.type, config: c.config_encrypted }),
      });
      const r = await res.json();
      const newStatus = r.ok ? "active" : "error";

      if (supabase) await supabase.from("connectors").update({ status: newStatus }).eq("id", c.id);
      await load();

      setTestResult({
        id: c.id,
        ok: r.ok,
        msg: r.ok ? `Connected${r.display_name ? ` — ${r.display_name}` : ""}` : `Failed: ${r.error}`,
      });
    } catch (err) {
      setTestResult({ id: c.id, ok: false, msg: "Test failed" });
    }
    setTestingId(null);
  }

  async function deleteConnector(id: string) {
    if (!supabase) return;
    await supabase.from("connectors").delete().eq("id", id);
    flash("ok", "Connector deleted");
    setSelectedConn(null);
    await load();
  }

  if (dbStatus !== "connected") {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <Info size={40} className="mx-auto text-purple-300" />
        <h1 className="text-xl font-bold">Connect Supabase First</h1>
        <p className="text-sm text-muted-foreground">Connectors are stored in your database. Set up Supabase to get started.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Connectors</h1>
          <p className="text-sm text-muted-foreground">Connect WhatsApp providers. Set one as primary and others as fallback.</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700">
          <Plus size={16} /> Add Connector
        </button>
      </div>

      {notice && (
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium ${notice.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
          {notice.type === "ok" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {notice.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active</p>
          <p className="mt-2 text-3xl font-bold">{connectors.filter((c) => c.status === "active").length}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fallback Ready</p>
          <p className="mt-2 text-3xl font-bold">{connectors.filter((c) => c.is_fallback && c.status === "active").length}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quality</p>
          <div className="mt-2 flex items-center gap-2">
            <QualityDot rating={connectors.find((c) => !c.is_fallback)?.quality_rating} />
            <span className="text-xl font-bold">{connectors.find((c) => !c.is_fallback)?.quality_rating ?? "N/A"}</span>
          </div>
        </div>
      </div>

      {/* Connector list */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-purple-400" /></div>
      ) : connectors.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed bg-white p-12 text-center">
          <Plug size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <h3 className="font-bold">No connectors yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Add a Meta Cloud API or BSP connector to start sending WhatsApp messages.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {connectors.map((c) => {
            const tm = TYPE_META[c.type] ?? TYPE_META.meta_cloud_api;
            const tr = testResult?.id === c.id ? testResult : null;
            return (
              <div key={c.id} className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
                        <tm.icon size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold">{c.name}</h3>
                        <p className="text-[11px] text-muted-foreground">{tm.label}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.is_fallback && <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[9px] font-bold text-blue-700">FALLBACK</span>}
                      <StatusBadge status={c.status} />
                    </div>
                  </div>

                  {(c.config_encrypted as any)?.display_name && (
                    <p className="mt-2 text-xs text-muted-foreground">{(c.config_encrypted as any).display_name}</p>
                  )}

                  <div className="mt-3 flex gap-3">
                    {c.messaging_tier && (
                      <div className="rounded-lg bg-muted p-2 flex-1">
                        <p className="text-[9px] font-semibold text-muted-foreground">TIER</p>
                        <p className="text-sm font-bold">{c.messaging_tier}</p>
                      </div>
                    )}
                    {c.quality_rating && (
                      <div className="rounded-lg bg-muted p-2 flex-1">
                        <p className="text-[9px] font-semibold text-muted-foreground">QUALITY</p>
                        <div className="flex items-center gap-1.5"><QualityDot rating={c.quality_rating} /><span className="text-sm font-bold">{c.quality_rating}</span></div>
                      </div>
                    )}
                  </div>

                  {tr && (
                    <div className={`mt-3 rounded-lg border p-2 text-xs font-medium flex items-center gap-1.5 ${tr.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                      {tr.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {tr.msg}
                    </div>
                  )}
                </div>
                <div className="flex border-t divide-x">
                  <button onClick={() => testConnection(c)} disabled={testingId === c.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-muted-foreground hover:text-purple-600 hover:bg-purple-50/50 disabled:opacity-60">
                    {testingId === c.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Test
                  </button>
                  <button onClick={() => setSelectedConn(c)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-muted-foreground hover:text-purple-600 hover:bg-purple-50/50">
                    <Settings2 size={12} /> Details
                  </button>
                  <button onClick={() => deleteConnector(c.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-muted-foreground hover:text-red-600 hover:bg-red-50">
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD MODAL */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white border shadow-xl p-6 space-y-4 mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Add Connector</h2>
              <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-muted rounded"><X size={18} /></button>
            </div>

            {/* Step 1: Pick type */}
            <div>
              <p className="text-sm font-semibold mb-2">1. Choose provider</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(TYPE_META).map(([k, v]) => (
                  <button key={k} onClick={() => { setNewType(k as ConnectorType); setNewConfig({}); }}
                    className={`text-left rounded-lg border p-3 text-sm transition ${newType === k ? "border-purple-500 bg-purple-50" : "border-border hover:border-purple-200"}`}>
                    <div className="flex items-center gap-2"><v.icon size={14} className="text-purple-600" /><span className="font-semibold">{v.label}</span></div>
                    <p className="text-[10px] text-muted-foreground mt-1">{v.hint}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Name + config */}
            <div>
              <p className="text-sm font-semibold mb-2">2. Configure</p>
              <label className="block text-sm font-medium mb-3">
                Display Name
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Production WhatsApp"
                  className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
              </label>

              {newType === "meta_cloud_api" && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium">
                    Phone Number ID <span className="text-red-500">*</span>
                    <input value={newConfig.phone_number_id ?? ""} onChange={(e) => updateCfg("phone_number_id", e.target.value)}
                      placeholder="From Meta Business Manager"
                      className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
                  </label>
                  <label className="block text-sm font-medium">
                    Permanent Access Token <span className="text-red-500">*</span>
                    <input type="password" value={newConfig.access_token ?? ""} onChange={(e) => updateCfg("access_token", e.target.value)}
                      placeholder="EAAxxxxxxx..."
                      className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
                  </label>
                  <label className="block text-sm font-medium">
                    Business Account ID (for templates)
                    <input value={newConfig.business_account_id ?? ""} onChange={(e) => updateCfg("business_account_id", e.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
                  </label>
                </div>
              )}

              {["360dialog", "wati", "interakt"].includes(newType) && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium">
                    Base URL <span className="text-red-500">*</span>
                    <input value={newConfig.base_url ?? ""} onChange={(e) => updateCfg("base_url", e.target.value)}
                      placeholder="https://..."
                      className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
                  </label>
                  <label className="block text-sm font-medium">
                    API Key <span className="text-red-500">*</span>
                    <input type="password" value={newConfig.api_key ?? ""} onChange={(e) => updateCfg("api_key", e.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
                  </label>
                </div>
              )}

              {newType === "crm_webhook" && (
                <label className="block text-sm font-medium">
                  Webhook URL
                  <input value={newConfig.base_url ?? ""} onChange={(e) => updateCfg("base_url", e.target.value)}
                    placeholder="https://hooks.your-crm.com/..."
                    className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
                </label>
              )}
            </div>

            {/* Step 3: Fallback toggle */}
            <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/30">
              <input type="checkbox" checked={isFallback} onChange={(e) => setIsFallback(e.target.checked)} className="size-4 accent-purple-600" />
              <div>
                <span className="text-sm font-semibold">Use as fallback</span>
                <p className="text-[11px] text-muted-foreground">Auto-retry via this connector when primary hits rate limit (error 130429)</p>
              </div>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAdd(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={addConnector} disabled={saving || !newName.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Testing & Saving..." : "Test & Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedConn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white border shadow-xl p-6 space-y-3 mx-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{selectedConn.name}</h2>
              <button onClick={() => setSelectedConn(null)} className="p-1 hover:bg-muted rounded"><X size={18} /></button>
            </div>
            {[
              ["Type", TYPE_META[selectedConn.type]?.label],
              ["Status", selectedConn.status],
              ["Fallback", selectedConn.is_fallback ? "Yes" : "No"],
              ["Tier", selectedConn.messaging_tier],
              ["Quality", selectedConn.quality_rating],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k as string} className="flex justify-between rounded-lg border p-3 text-sm">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => deleteConnector(selectedConn.id)} className="rounded-lg bg-red-50 border-red-200 border px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100">Delete</button>
              <button onClick={() => setSelectedConn(null)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
