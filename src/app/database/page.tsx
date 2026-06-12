"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, Upload, Plus, Filter, Users, X, CheckCircle2, AlertTriangle,
  Trash2, Edit3, Save, Loader2, RefreshCw, Info, UserPlus, Eye,
} from "lucide-react";
import { useApp } from "@/lib/AppContext";
import { supabase } from "@/lib/supabase";
import type { OptinCategory } from "@/lib/types";

type DBContact = {
  id: string; phone: string; name: string | null; optin_category: string;
  tier_tag: string; last_message_at: string | null; block_count: number;
  optin_source: string | null; created_at: string;
};

type DBSegment = {
  id: string; name: string; filter_query: string; contact_count: number; created_at: string;
};

const OPTIN_OPTIONS: { value: OptinCategory; label: string; color: string }[] = [
  { value: "none", label: "None", color: "bg-gray-100 text-gray-600 border-gray-200" },
  { value: "utility_only", label: "Utility Only", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "marketing", label: "Marketing", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "double_confirmed", label: "Confirmed", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "opted_out", label: "Opted Out", color: "bg-red-50 text-red-700 border-red-200" },
];
const TIER_OPTIONS = ["VIP", "Regular", "New"];

function OptinBadge({ category }: { category: string }) {
  const opt = OPTIN_OPTIONS.find((o) => o.value === category) ?? OPTIN_OPTIONS[0];
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${opt.color}`}>{opt.label}</span>;
}

function TierBadge({ tier }: { tier: string }) {
  const map: Record<string, string> = { VIP: "bg-amber-50 text-amber-700 border-amber-200", Regular: "bg-gray-100 text-gray-600 border-gray-200", New: "bg-blue-50 text-blue-600 border-blue-200" };
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${map[tier] ?? map.New}`}>{tier}</span>;
}

function parseContactIds(filterQuery: string): string[] {
  try {
    const parsed = JSON.parse(filterQuery);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

export default function DatabasePage() {
  const { userId, dbStatus } = useApp();
  const [contacts, setContacts] = useState<DBContact[]>([]);
  const [segments, setSegments] = useState<DBSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOptin, setFilterOptin] = useState("all");
  const [filterTier, setFilterTier] = useState("all");
  const [activeTab, setActiveTab] = useState<"contacts" | "segments">("contacts");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAddContact, setShowAddContact] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAddSegment, setShowAddSegment] = useState(false);
  const [showAddToSegment, setShowAddToSegment] = useState(false);
  const [viewingSegment, setViewingSegment] = useState<DBSegment | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [formPhone, setFormPhone] = useState("");
  const [formName, setFormName] = useState("");
  const [formOptin, setFormOptin] = useState<OptinCategory>("none");
  const [formTier, setFormTier] = useState("New");
  const [formSource, setFormSource] = useState("");
  const [segName, setSegName] = useState("");

  const flash = useCallback((type: "ok" | "err", text: string) => {
    setNotice({ type, text }); setTimeout(() => setNotice(null), 4000);
  }, []);

  const loadContacts = useCallback(async () => {
    if (!supabase || !userId) return;
    const { data } = await supabase.from("contacts")
      .select("id, phone, name, optin_category, tier_tag, last_message_at, block_count, optin_source, created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(500);
    if (data) setContacts(data);
  }, [userId]);

  const loadSegments = useCallback(async () => {
    if (!supabase || !userId) return;
    const { data } = await supabase.from("segments")
      .select("id, name, filter_query, contact_count, created_at")
      .eq("user_id", userId).order("created_at", { ascending: false });
    if (data) setSegments(data);
  }, [userId]);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([loadContacts(), loadSegments()]).finally(() => setLoading(false));
  }, [userId, loadContacts, loadSegments]);

  async function addContact() {
    if (!supabase || !userId || !formPhone.trim()) { flash("err", "Phone required"); return; }
    setSaving(true);
    const { error } = await supabase.from("contacts").insert({
      user_id: userId, phone: formPhone.trim(), name: formName.trim() || null,
      optin_category: formOptin, tier_tag: formTier,
      optin_source: formSource.trim() || null,
      optin_timestamp: formOptin !== "none" ? new Date().toISOString() : null,
    });
    if (error) { flash("err", error.message.includes("duplicate") ? "Phone already exists" : error.message); }
    else { flash("ok", "Contact added"); resetForm(); setShowAddContact(false); await loadContacts(); }
    setSaving(false);
  }

  async function updateContact(id: string, updates: Partial<DBContact>) {
    if (!supabase) return;
    setSaving(true);
    const { error } = await supabase.from("contacts").update(updates).eq("id", id);
    if (error) flash("err", error.message);
    else { flash("ok", "Updated"); setEditingId(null); await loadContacts(); }
    setSaving(false);
  }

  async function deleteContacts(ids: string[]) {
    if (!supabase) return;
    setSaving(true);
    const { error } = await supabase.from("contacts").delete().in("id", ids);
    if (!error) { flash("ok", `${ids.length} deleted`); setSelectedIds(new Set()); await loadContacts(); }
    else flash("err", error.message);
    setSaving(false);
  }

  async function bulkUpdateOptin(category: OptinCategory) {
    if (!supabase) return;
    setSaving(true);
    const { error } = await supabase.from("contacts").update({ optin_category: category }).in("id", Array.from(selectedIds));
    if (!error) { flash("ok", `${selectedIds.size} updated to ${category}`); setSelectedIds(new Set()); await loadContacts(); }
    setSaving(false);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !supabase || !userId) return;
    setSaving(true);
    try {
      const text = await file.text();
      const lines = text.trim().split("\n");
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
      const phoneIdx = headers.findIndex((h) => ["phone", "mobile", "whatsapp", "number"].includes(h));
      const nameIdx = headers.findIndex((h) => ["name", "full_name", "customer"].includes(h));
      if (phoneIdx === -1) { flash("err", "CSV needs a 'phone' column"); setSaving(false); return; }
      const rows = lines.slice(1).map((line) => {
        const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        return { user_id: userId, phone: cols[phoneIdx], name: nameIdx >= 0 ? cols[nameIdx] || null : null, optin_source: "csv_import", optin_category: "none" as const, tier_tag: "New" as const };
      }).filter((r) => r.phone);
      const { error } = await supabase.from("contacts").upsert(rows, { onConflict: "user_id,phone" });
      if (error) flash("err", error.message);
      else { flash("ok", `${rows.length} contacts imported`); setShowImport(false); await loadContacts(); }
    } catch { flash("err", "Failed to parse CSV"); }
    e.target.value = "";
    setSaving(false);
  }

  // ── SEGMENT: Create empty ──
  async function createSegment() {
    if (!supabase || !userId || !segName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("segments").insert({
      user_id: userId, name: segName.trim(), filter_query: "[]", contact_count: 0,
    });
    if (error) flash("err", error.message);
    else { flash("ok", "Segment created"); setShowAddSegment(false); setSegName(""); await loadSegments(); }
    setSaving(false);
  }

  // ── SEGMENT: Add selected contacts ──
  async function addContactsToSegment(segmentId: string) {
    if (!supabase || selectedIds.size === 0) return;
    setSaving(true);
    const seg = segments.find((s) => s.id === segmentId);
    if (!seg) { setSaving(false); return; }

    const existing = parseContactIds(seg.filter_query);
    const merged = Array.from(new Set([...existing, ...Array.from(selectedIds)]));

    const { error } = await supabase.from("segments").update({
      filter_query: JSON.stringify(merged),
      contact_count: merged.length,
    }).eq("id", segmentId);

    if (error) flash("err", error.message);
    else { flash("ok", `${selectedIds.size} contact(s) added to "${seg.name}"`); setSelectedIds(new Set()); setShowAddToSegment(false); await loadSegments(); }
    setSaving(false);
  }

  // ── SEGMENT: Remove contact ──
  async function removeFromSegment(segmentId: string, contactId: string) {
    if (!supabase) return;
    const seg = segments.find((s) => s.id === segmentId);
    if (!seg) return;
    const ids = parseContactIds(seg.filter_query).filter((id) => id !== contactId);
    await supabase.from("segments").update({ filter_query: JSON.stringify(ids), contact_count: ids.length }).eq("id", segmentId);
    flash("ok", "Contact removed from segment");
    await loadSegments();
    if (viewingSegment?.id === segmentId) setViewingSegment({ ...seg, filter_query: JSON.stringify(ids), contact_count: ids.length });
  }

  async function deleteSegment(id: string) {
    if (!supabase) return;
    await supabase.from("segments").delete().eq("id", id);
    flash("ok", "Segment deleted");
    if (viewingSegment?.id === id) setViewingSegment(null);
    await loadSegments();
  }

  function resetForm() { setFormPhone(""); setFormName(""); setFormOptin("none"); setFormTier("New"); setFormSource(""); }
  function toggleId(id: string) { setSelectedIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  const filtered = contacts.filter((c) => {
    if (searchQuery) { const q = searchQuery.toLowerCase(); if (!c.phone.includes(q) && !c.name?.toLowerCase().includes(q)) return false; }
    if (filterOptin !== "all" && c.optin_category !== filterOptin) return false;
    if (filterTier !== "all" && c.tier_tag !== filterTier) return false;
    return true;
  });

  const segmentContacts = viewingSegment ? contacts.filter((c) => parseContactIds(viewingSegment.filter_query).includes(c.id)) : [];

  if (dbStatus !== "connected") {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <Info size={40} className="mx-auto text-purple-300" />
        <h1 className="text-xl font-bold">Database Not Connected</h1>
        <p className="text-sm text-muted-foreground">Add Supabase credentials to <code className="bg-muted px-1.5 py-0.5 rounded text-xs">.env.local</code> and run the SQL schema.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Database</h1>
          <p className="text-sm text-muted-foreground">Manage contacts, opt-in states, and audience segments.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { resetForm(); setShowAddContact(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">
            <Plus size={14} /> Add Contact
          </button>
          <button onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-muted">
            <Upload size={14} /> Import
          </button>
          <button onClick={() => { loadContacts(); loadSegments(); }}
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-muted">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {notice && (
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium ${notice.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
          {notice.type === "ok" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {notice.text}
        </div>
      )}

      <div className="flex gap-1 border-b">
        <button onClick={() => { setActiveTab("contacts"); setViewingSegment(null); }}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 ${activeTab === "contacts" ? "border-purple-600 text-purple-600" : "border-transparent text-muted-foreground"}`}>
          <Users size={14} className="inline mr-1.5 -mt-0.5" /> Contacts ({contacts.length})
        </button>
        <button onClick={() => setActiveTab("segments")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 ${activeTab === "segments" ? "border-purple-600 text-purple-600" : "border-transparent text-muted-foreground"}`}>
          <Filter size={14} className="inline mr-1.5 -mt-0.5" /> Segments ({segments.length})
        </button>
      </div>

      {/* ═══ CONTACTS TAB ═══ */}
      {activeTab === "contacts" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name or phone..."
                className="h-9 w-full rounded-lg border bg-white pl-8 pr-3 text-sm outline-none focus:border-purple-500" />
            </div>
            <select value={filterOptin} onChange={(e) => setFilterOptin(e.target.value)} className="h-9 rounded-lg border bg-white px-3 text-sm outline-none">
              <option value="all">All Opt-in</option>
              {OPTIN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} className="h-9 rounded-lg border bg-white px-3 text-sm outline-none">
              <option value="all">All Tiers</option>
              {TIER_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2.5">
              <span className="text-sm font-semibold text-purple-700">{selectedIds.size} selected</span>
              <button onClick={() => setShowAddToSegment(true)}
                className="inline-flex items-center gap-1 rounded-md bg-white border border-purple-200 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100">
                <UserPlus size={12} /> Add to Segment
              </button>
              <select onChange={(e) => { if (e.target.value) bulkUpdateOptin(e.target.value as OptinCategory); e.target.value = ""; }}
                className="h-8 rounded-md border border-purple-200 bg-white px-2 text-xs font-medium text-purple-700">
                <option value="">Set Opt-in...</option>
                {OPTIN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button onClick={() => deleteContacts(Array.from(selectedIds))}
                className="inline-flex items-center gap-1 rounded-md bg-white border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                <Trash2 size={12} /> Delete
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-purple-600 font-medium hover:underline">Clear</button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-purple-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed bg-white p-12 text-center">
              <Users size={40} className="mx-auto text-muted-foreground/30 mb-3" />
              <h3 className="font-bold">{contacts.length === 0 ? "No contacts yet" : "No matches"}</h3>
              <p className="text-sm text-muted-foreground mt-1">{contacts.length === 0 ? "Add your first contact or import a CSV." : "Adjust search or filters."}</p>
            </div>
          ) : (
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-muted-foreground text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 w-10">
                        <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0}
                          onChange={() => selectedIds.size === filtered.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(filtered.map((c) => c.id)))}
                          className="size-3.5 accent-purple-600" />
                      </th>
                      <th className="px-4 py-3 text-left">Phone</th>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-center">Opt-in</th>
                      <th className="px-4 py-3 text-center">Tier</th>
                      <th className="px-4 py-3 text-center">Blocks</th>
                      <th className="px-4 py-3 text-right">Source</th>
                      <th className="px-4 py-3 w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleId(c.id)} className="size-3.5 accent-purple-600" /></td>
                        <td className="px-4 py-3 font-mono text-xs font-medium">{c.phone}</td>
                        <td className="px-4 py-3">
                          {editingId === c.id ? (
                            <input defaultValue={c.name ?? ""} onBlur={(e) => updateContact(c.id, { name: e.target.value || null } as any)}
                              className="h-7 w-full rounded border border-purple-300 px-2 text-xs outline-none" autoFocus />
                          ) : (
                            <span className="cursor-pointer hover:text-purple-600" onClick={() => setEditingId(c.id)}>
                              {c.name || <span className="text-muted-foreground">—</span>}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {editingId === c.id ? (
                            <select defaultValue={c.optin_category} onChange={(e) => updateContact(c.id, { optin_category: e.target.value } as any)}
                              className="h-7 rounded border border-purple-300 px-1 text-[10px] outline-none">
                              {OPTIN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          ) : <OptinBadge category={c.optin_category} />}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {editingId === c.id ? (
                            <select defaultValue={c.tier_tag} onChange={(e) => updateContact(c.id, { tier_tag: e.target.value } as any)}
                              className="h-7 rounded border border-purple-300 px-1 text-[10px] outline-none">
                              {TIER_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          ) : <TierBadge tier={c.tier_tag} />}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {c.block_count > 0 ? <span className="text-xs font-bold text-red-600">{c.block_count}</span> : <span className="text-xs text-muted-foreground">0</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">{c.optin_source || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => setEditingId(editingId === c.id ? null : c.id)} className="p-1 rounded hover:bg-purple-50 text-muted-foreground hover:text-purple-600"><Edit3 size={13} /></button>
                            <button onClick={() => deleteContacts([c.id])} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length > 0 && (
                <div className="bg-muted px-4 py-2 border-t text-xs text-muted-foreground text-center">Showing {filtered.length} of {contacts.length} contacts</div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══ SEGMENTS TAB ═══ */}
      {activeTab === "segments" && !viewingSegment && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Select contacts in the Contacts tab, then click &quot;Add to Segment&quot; to populate.</p>
            <button onClick={() => setShowAddSegment(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">
              <Plus size={14} /> Create Segment
            </button>
          </div>

          {segments.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed bg-white p-12 text-center">
              <Filter size={40} className="mx-auto text-muted-foreground/30 mb-3" />
              <h3 className="font-bold">No segments yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Create a segment, then go to Contacts → select contacts → &quot;Add to Segment&quot;.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {segments.map((seg) => (
                <div key={seg.id} className="rounded-xl border bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold">{seg.name}</h3>
                    <button onClick={() => deleteSegment(seg.id)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 size={13} /></button>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-200 px-2.5 py-1 text-xs font-bold text-purple-700">
                      <Users size={11} /> {seg.contact_count} contacts
                    </span>
                    <span className="text-[10px] text-muted-foreground">Created {new Date(seg.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                  </div>
                  <button onClick={() => setViewingSegment(seg)}
                    className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-purple-600 hover:border-purple-200 hover:bg-purple-50/50">
                    <Eye size={12} /> View Contacts
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ VIEWING SEGMENT CONTACTS ═══ */}
      {activeTab === "segments" && viewingSegment && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <button onClick={() => setViewingSegment(null)} className="text-xs text-purple-600 hover:underline mb-1">← Back to Segments</button>
              <h2 className="text-lg font-bold">{viewingSegment.name}</h2>
              <p className="text-sm text-muted-foreground">{segmentContacts.length} contacts in this segment</p>
            </div>
          </div>

          {segmentContacts.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed bg-white p-12 text-center">
              <Users size={36} className="mx-auto text-muted-foreground/30 mb-3" />
              <h3 className="font-bold">No contacts in this segment</h3>
              <p className="text-sm text-muted-foreground mt-1">Go to Contacts tab → select contacts → click &quot;Add to Segment&quot;.</p>
            </div>
          ) : (
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Phone</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-center">Opt-in</th>
                    <th className="px-4 py-3 text-center">Tier</th>
                    <th className="px-4 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {segmentContacts.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs font-medium">{c.phone}</td>
                      <td className="px-4 py-3">{c.name || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3 text-center"><OptinBadge category={c.optin_category} /></td>
                      <td className="px-4 py-3 text-center"><TierBadge tier={c.tier_tag} /></td>
                      <td className="px-4 py-3">
                        <button onClick={() => removeFromSegment(viewingSegment.id, c.id)}
                          className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600" title="Remove from segment">
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ADD CONTACT MODAL ── */}
      {showAddContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white border shadow-xl p-6 space-y-4 mx-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Add Contact</h2>
              <button onClick={() => setShowAddContact(false)} className="p-1 hover:bg-muted rounded"><X size={18} /></button>
            </div>
            <label className="block text-sm font-semibold">
              Phone (E.164) <span className="text-red-500">*</span>
              <input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="+919900000001"
                className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
            </label>
            <label className="block text-sm font-semibold">
              Name
              <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Contact name"
                className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold">
                Opt-in
                <select value={formOptin} onChange={(e) => setFormOptin(e.target.value as OptinCategory)}
                  className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500">
                  {OPTIN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Tier
                <select value={formTier} onChange={(e) => setFormTier(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500">
                  {TIER_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-sm font-semibold">
              Source
              <input value={formSource} onChange={(e) => setFormSource(e.target.value)} placeholder="e.g. website_form"
                className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAddContact(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={addContact} disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── IMPORT MODAL ── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white border shadow-xl p-6 space-y-4 mx-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Import CSV</h2>
              <button onClick={() => setShowImport(false)} className="p-1 hover:bg-muted rounded"><X size={18} /></button>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">CSV format:</p>
              <p>Required: <code className="bg-white/60 px-1 rounded">phone</code></p>
              <p>Optional: <code className="bg-white/60 px-1 rounded">name</code></p>
              <p>Duplicates are merged by phone number.</p>
            </div>
            <label className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed hover:border-purple-400 hover:bg-purple-50/50">
              <Upload size={24} className="text-purple-400 mb-2" />
              <span className="text-sm font-semibold">{saving ? "Importing..." : "Click to select CSV"}</span>
              <input type="file" accept=".csv" onChange={handleImport} className="sr-only" disabled={saving} />
            </label>
            <button onClick={() => setShowImport(false)} className="w-full rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">Close</button>
          </div>
        </div>
      )}

      {/* ── CREATE SEGMENT MODAL ── */}
      {showAddSegment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white border shadow-xl p-6 space-y-4 mx-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Create Segment</h2>
              <button onClick={() => setShowAddSegment(false)} className="p-1 hover:bg-muted rounded"><X size={18} /></button>
            </div>
            <label className="block text-sm font-semibold">
              Segment Name <span className="text-red-500">*</span>
              <input value={segName} onChange={(e) => setSegName(e.target.value)} placeholder="e.g. VIP Customers, New Leads"
                className="mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
            </label>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
              After creating, go to <strong>Contacts</strong> tab → select contacts → click <strong>&quot;Add to Segment&quot;</strong>.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAddSegment(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={createSegment} disabled={saving || !segName.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD TO SEGMENT MODAL ── */}
      {showAddToSegment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white border shadow-xl p-6 space-y-4 mx-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Add {selectedIds.size} Contact(s) to Segment</h2>
              <button onClick={() => setShowAddToSegment(false)} className="p-1 hover:bg-muted rounded"><X size={18} /></button>
            </div>
            {segments.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">No segments yet.</p>
                <button onClick={() => { setShowAddToSegment(false); setShowAddSegment(true); }}
                  className="mt-2 text-sm font-semibold text-purple-600 hover:underline">Create one first</button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {segments.map((seg) => (
                  <button key={seg.id} onClick={() => addContactsToSegment(seg.id)}
                    className="w-full flex items-center justify-between rounded-lg border p-4 text-left hover:border-purple-300 hover:bg-purple-50/50 transition">
                    <div>
                      <p className="text-sm font-semibold">{seg.name}</p>
                      <p className="text-[11px] text-muted-foreground">{seg.contact_count} contacts</p>
                    </div>
                    <UserPlus size={16} className="text-purple-400" />
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setShowAddToSegment(false)} className="w-full rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
