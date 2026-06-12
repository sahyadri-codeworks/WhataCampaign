"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  X,
  AlertTriangle,
  Plug,
  Settings2,
  Activity,
  Wifi,
  WifiOff,
  ExternalLink,
  RefreshCw,
  Shield,
  Zap,
  Globe,
  Loader2,
  CheckCircle2,
  XCircle,
  Save,
} from "lucide-react";
import type { ConnectorType, QualityRating } from "@/lib/types";

type StoredConnector = {
  id: string;
  name: string;
  type: ConnectorType;
  status: "active" | "inactive" | "error";
  is_fallback: boolean;
  config: Record<string, string>;
  last_successful_send?: string;
  error_rate_24h: number;
  messaging_tier?: string;
  quality_rating?: QualityRating;
};

const STORAGE_KEY = "whatacampaign.connectors";

function loadConnectors(): StoredConnector[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveConnectors(connectors: StoredConnector[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connectors));
}

const connectorTypeLabels: Record<ConnectorType, { label: string; icon: typeof Plug }> = {
  meta_cloud_api: { label: "Meta Cloud API", icon: Zap },
  "360dialog": { label: "360dialog", icon: Globe },
  wati: { label: "Wati", icon: Globe },
  interakt: { label: "Interakt", icon: Globe },
  crm_webhook: { label: "CRM Webhook", icon: ExternalLink },
};

function QualityDot({ rating }: { rating?: QualityRating }) {
  if (!rating) return null;
  const colors = { GREEN: "bg-emerald-500", YELLOW: "bg-amber-500", RED: "bg-red-500" };
  return <span className={`size-2.5 rounded-full ${colors[rating]}`} />;
}

function StatusIndicator({ status }: { status: StoredConnector["status"] }) {
  const config = {
    active: { icon: Wifi, text: "Active", cls: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    inactive: { icon: WifiOff, text: "Inactive", cls: "text-gray-500 bg-gray-50 border-gray-200" },
    error: { icon: AlertTriangle, text: "Error", cls: "text-red-600 bg-red-50 border-red-200" },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${config.cls}`}>
      <config.icon size={10} />
      {config.text}
    </span>
  );
}

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<StoredConnector[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState<ConnectorType>("meta_cloud_api");
  const [newName, setNewName] = useState("");
  const [newConfig, setNewConfig] = useState<Record<string, string>>({});
  const [isFallback, setIsFallback] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; message: string } | null>(null);
  const [selectedConnector, setSelectedConnector] = useState<StoredConnector | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setConnectors(loadConnectors());
  }, []);

  function updateConfig(key: string, value: string) {
    setNewConfig((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAddConnector() {
    if (!newName.trim()) return;
    setSaving(true);

    const connector: StoredConnector = {
      id: crypto.randomUUID(),
      name: newName,
      type: newType,
      status: "inactive",
      is_fallback: isFallback,
      config: newConfig,
      error_rate_24h: 0,
    };

    // Test the connection first
    try {
      const res = await fetch("/api/connectors/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: newType, config: newConfig }),
      });
      const result = await res.json();

      if (result.ok) {
        connector.status = "active";
        if (result.phone_number) {
          connector.config.display_phone = result.phone_number;
        }
        if (result.display_name) {
          connector.config.display_name = result.display_name;
        }
      } else {
        connector.status = "error";
      }
    } catch {
      connector.status = "inactive";
    }

    // Fetch quality rating for Meta API connectors
    if (newType === "meta_cloud_api" && connector.status === "active") {
      try {
        const res = await fetch("/api/connectors/quality", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone_number_id: newConfig.phone_number_id,
            access_token: newConfig.access_token,
          }),
        });
        const rating = await res.json();
        if (rating.quality_rating) {
          connector.quality_rating = rating.quality_rating as QualityRating;
          connector.messaging_tier = rating.messaging_limit_tier;
        }
      } catch {
        // Quality rating fetch is non-critical
      }
    }

    const updated = [...connectors, connector];
    setConnectors(updated);
    saveConnectors(updated);
    setShowAdd(false);
    setNewName("");
    setNewConfig({});
    setNewType("meta_cloud_api");
    setIsFallback(false);
    setSaving(false);
  }

  async function testConnection(connector: StoredConnector) {
    setTestingId(connector.id);
    setTestResult(null);

    try {
      const res = await fetch("/api/connectors/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: connector.type, config: connector.config }),
      });
      const result = await res.json();

      const updated = connectors.map((c) => {
        if (c.id === connector.id) {
          return {
            ...c,
            status: (result.ok ? "active" : "error") as StoredConnector["status"],
          };
        }
        return c;
      });
      setConnectors(updated);
      saveConnectors(updated);

      setTestResult({
        id: connector.id,
        ok: result.ok,
        message: result.ok
          ? `Connected${result.display_name ? ` — ${result.display_name}` : ""}${result.phone_number ? ` (${result.phone_number})` : ""}`
          : `Failed: ${result.error || "Unknown error"}`,
      });
    } catch (err) {
      setTestResult({
        id: connector.id,
        ok: false,
        message: err instanceof Error ? err.message : "Connection test failed",
      });
    }

    setTestingId(null);
  }

  function deleteConnector(id: string) {
    const updated = connectors.filter((c) => c.id !== id);
    setConnectors(updated);
    saveConnectors(updated);
    setSelectedConnector(null);
  }

  const activeCount = connectors.filter((c) => c.status === "active").length;
  const avgError = connectors.length > 0
    ? (connectors.reduce((s, c) => s + c.error_rate_24h, 0) / connectors.length).toFixed(1)
    : "0.0";
  const primaryQuality = connectors.find((c) => !c.is_fallback && c.quality_rating)?.quality_rating;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Connectors</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage WhatsApp BSP connections and webhook integrations.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700"
        >
          <Plus size={16} /> Add Connector
        </button>
      </div>

      {/* Health overview */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Connectors</p>
            <Activity size={16} className="text-emerald-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avg Error Rate (24h)</p>
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">{avgError}%</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quality Rating</p>
            <Shield size={16} className="text-purple-500" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            {primaryQuality ? (
              <>
                <QualityDot rating={primaryQuality} />
                <span className={`text-xl font-bold ${primaryQuality === "GREEN" ? "text-emerald-600" : primaryQuality === "YELLOW" ? "text-amber-600" : "text-red-600"}`}>
                  {primaryQuality}
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">No data</span>
            )}
          </div>
        </div>
      </div>

      {/* Connector cards */}
      {connectors.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border bg-white p-12 text-center">
          <Plug size={40} className="mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-bold text-foreground">No connectors yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Add a Meta Cloud API or BSP connector to start sending messages.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          >
            <Plus size={14} /> Add Your First Connector
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {connectors.map((c) => {
            const typeDef = connectorTypeLabels[c.type];
            const thisTestResult = testResult?.id === c.id ? testResult : null;
            return (
              <div key={c.id} className="rounded-xl border border-border bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
                        <typeDef.icon size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">{c.name}</h3>
                        <p className="text-[11px] text-muted-foreground">{typeDef.label}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.is_fallback && (
                        <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[9px] font-bold text-blue-700">
                          FALLBACK
                        </span>
                      )}
                      <StatusIndicator status={c.status} />
                    </div>
                  </div>

                  {c.config.display_name && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {c.config.display_name} {c.config.display_phone && `(${c.config.display_phone})`}
                    </p>
                  )}

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {c.messaging_tier && (
                      <div className="rounded-lg bg-muted p-2.5">
                        <p className="text-[10px] font-semibold text-muted-foreground">Tier</p>
                        <p className="text-sm font-bold text-foreground mt-0.5">{c.messaging_tier}</p>
                      </div>
                    )}
                    <div className="rounded-lg bg-muted p-2.5">
                      <p className="text-[10px] font-semibold text-muted-foreground">Error Rate</p>
                      <p className={`text-sm font-bold mt-0.5 ${c.error_rate_24h > 2 ? "text-red-600" : "text-foreground"}`}>
                        {c.error_rate_24h}%
                      </p>
                    </div>
                    {c.quality_rating && (
                      <div className="rounded-lg bg-muted p-2.5">
                        <p className="text-[10px] font-semibold text-muted-foreground">Quality</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <QualityDot rating={c.quality_rating} />
                          <span className="text-sm font-bold">{c.quality_rating}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {thisTestResult && (
                    <div className={`mt-3 rounded-lg border p-2.5 text-xs font-medium ${
                      thisTestResult.ok
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-red-200 bg-red-50 text-red-700"
                    }`}>
                      <div className="flex items-center gap-1.5">
                        {thisTestResult.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {thisTestResult.message}
                      </div>
                    </div>
                  )}

                  {c.last_successful_send && (
                    <p className="mt-3 text-[10px] text-muted-foreground">
                      Last send: {new Date(c.last_successful_send).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>

                <div className="flex border-t border-border divide-x divide-border">
                  <button
                    onClick={() => testConnection(c)}
                    disabled={testingId === c.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-muted-foreground hover:text-purple-600 hover:bg-purple-50/50 transition-colors disabled:opacity-60"
                  >
                    {testingId === c.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <RefreshCw size={12} />
                    )}
                    Test
                  </button>
                  <button
                    onClick={() => setSelectedConnector(c)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-muted-foreground hover:text-purple-600 hover:bg-purple-50/50 transition-colors"
                  >
                    <Settings2 size={12} /> Configure
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add connector modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white border border-border shadow-xl p-6 space-y-4 mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Add Connector</h2>
              <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-muted rounded text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            <label className="block text-sm font-semibold">
              Connector Name
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Production WhatsApp"
                className="mt-1.5 h-10 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </label>

            <label className="block text-sm font-semibold">
              Type
              <select
                value={newType}
                onChange={(e) => { setNewType(e.target.value as ConnectorType); setNewConfig({}); }}
                className="mt-1.5 h-10 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-purple-500"
              >
                <option value="meta_cloud_api">Meta Cloud API</option>
                <option value="360dialog">360dialog</option>
                <option value="wati">Wati</option>
                <option value="interakt">Interakt</option>
                <option value="crm_webhook">CRM Webhook</option>
              </select>
            </label>

            {newType === "meta_cloud_api" && (
              <>
                <label className="block text-sm font-semibold">
                  Phone Number ID
                  <input
                    value={newConfig.phone_number_id ?? ""}
                    onChange={(e) => updateConfig("phone_number_id", e.target.value)}
                    placeholder="e.g., 123456789012345"
                    className="mt-1.5 h-10 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-purple-500"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Permanent Access Token
                  <input
                    type="password"
                    value={newConfig.access_token ?? ""}
                    onChange={(e) => updateConfig("access_token", e.target.value)}
                    placeholder="EAAxxxxxxx..."
                    className="mt-1.5 h-10 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-purple-500"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Business Account ID (for templates)
                  <input
                    value={newConfig.business_account_id ?? ""}
                    onChange={(e) => updateConfig("business_account_id", e.target.value)}
                    placeholder="e.g., 987654321098765"
                    className="mt-1.5 h-10 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-purple-500"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Webhook Verify Token
                  <input
                    value={newConfig.webhook_verify_token ?? ""}
                    onChange={(e) => updateConfig("webhook_verify_token", e.target.value)}
                    placeholder="Custom verify string"
                    className="mt-1.5 h-10 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-purple-500"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  API Version
                  <input
                    value={newConfig.api_version ?? "v18.0"}
                    onChange={(e) => updateConfig("api_version", e.target.value)}
                    placeholder="v18.0"
                    className="mt-1.5 h-10 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-purple-500"
                  />
                </label>
              </>
            )}

            {(newType === "360dialog" || newType === "wati" || newType === "interakt") && (
              <>
                <label className="block text-sm font-semibold">
                  Base URL
                  <input
                    value={newConfig.base_url ?? ""}
                    onChange={(e) => updateConfig("base_url", e.target.value)}
                    placeholder={
                      newType === "360dialog" ? "https://waba.360dialog.io" :
                      newType === "wati" ? "https://live-server-xxxxx.wati.io" :
                      "https://api.interakt.ai"
                    }
                    className="mt-1.5 h-10 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-purple-500"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  API Key
                  <input
                    type="password"
                    value={newConfig.api_key ?? ""}
                    onChange={(e) => updateConfig("api_key", e.target.value)}
                    placeholder="Your API key"
                    className="mt-1.5 h-10 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-purple-500"
                  />
                </label>
              </>
            )}

            {newType === "crm_webhook" && (
              <>
                <label className="block text-sm font-semibold">
                  Webhook URL
                  <input
                    value={newConfig.base_url ?? ""}
                    onChange={(e) => updateConfig("base_url", e.target.value)}
                    placeholder="https://hooks.your-crm.com/..."
                    className="mt-1.5 h-10 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-purple-500"
                  />
                </label>
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <p className="text-xs font-semibold text-blue-700">Events to send:</p>
                  <div className="mt-2 space-y-1">
                    {["optin_captured", "message_delivered", "reply_received"].map((evt) => (
                      <label key={evt} className="flex items-center gap-2 text-xs text-blue-600">
                        <input type="checkbox" defaultChecked className="size-3.5 accent-purple-600" />
                        {evt}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={isFallback}
                onChange={(e) => setIsFallback(e.target.checked)}
                className="size-4 accent-purple-600"
              />
              Set as fallback connector (used when primary returns rate limit 130429)
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAdd(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={handleAddConnector}
                disabled={saving || !newName.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Testing & Saving..." : "Test & Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Config panel modal */}
      {selectedConnector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white border border-border shadow-xl p-6 space-y-4 mx-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Configure: {selectedConnector.name}</h2>
              <button onClick={() => setSelectedConnector(null)} className="p-1 hover:bg-muted rounded text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-border p-3 flex justify-between">
                <span className="text-sm text-muted-foreground">Type</span>
                <span className="text-sm font-semibold">{connectorTypeLabels[selectedConnector.type].label}</span>
              </div>
              <div className="rounded-lg border border-border p-3 flex justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <StatusIndicator status={selectedConnector.status} />
              </div>
              {selectedConnector.config.phone_number_id && (
                <div className="rounded-lg border border-border p-3 flex justify-between">
                  <span className="text-sm text-muted-foreground">Phone Number ID</span>
                  <span className="text-sm font-mono font-medium">{selectedConnector.config.phone_number_id}</span>
                </div>
              )}
              {selectedConnector.config.display_name && (
                <div className="rounded-lg border border-border p-3 flex justify-between">
                  <span className="text-sm text-muted-foreground">Verified Name</span>
                  <span className="text-sm font-semibold">{selectedConnector.config.display_name}</span>
                </div>
              )}
              {selectedConnector.messaging_tier && (
                <div className="rounded-lg border border-border p-3 flex justify-between">
                  <span className="text-sm text-muted-foreground">Messaging Tier</span>
                  <span className="text-sm font-bold text-purple-600">{selectedConnector.messaging_tier}</span>
                </div>
              )}
              {selectedConnector.quality_rating && (
                <div className="rounded-lg border border-border p-3 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Quality Rating</span>
                  <div className="flex items-center gap-1.5">
                    <QualityDot rating={selectedConnector.quality_rating} />
                    <span className="text-sm font-bold">{selectedConnector.quality_rating}</span>
                  </div>
                </div>
              )}
              {selectedConnector.config.base_url && (
                <div className="rounded-lg border border-border p-3 flex justify-between">
                  <span className="text-sm text-muted-foreground">Endpoint</span>
                  <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">{selectedConnector.config.base_url}</span>
                </div>
              )}
              <div className="rounded-lg border border-border p-3 flex justify-between">
                <span className="text-sm text-muted-foreground">Fallback</span>
                <span className="text-sm font-semibold">{selectedConnector.is_fallback ? "Yes" : "No"}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => deleteConnector(selectedConnector.id)}
                className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
              >
                Delete
              </button>
              <button onClick={() => setSelectedConnector(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
