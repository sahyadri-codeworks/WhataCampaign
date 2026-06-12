"use client";

import { useState } from "react";
import {
  Search,
  Upload,
  Download,
  Plus,
  Filter,
  ChevronDown,
  Users,
  Shield,
  Tag,
  Clock,
  X,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Trash2,
  Edit3,
} from "lucide-react";
import type { Contact, OptinCategory, Segment } from "@/lib/types";

const mockContacts: Contact[] = [
  { id: "1", phone: "+919900000001", name: "Aarav Patel", optin_category: "marketing", optin_source: "website_form", optin_timestamp: "2026-05-15T10:30:00Z", tier_tag: "VIP", last_message_at: "2026-06-10T14:20:00Z", block_count: 0, custom_fields: { city: "Mumbai", plan: "Premium" }, extraData: {} },
  { id: "2", phone: "+919900000002", name: "Diya Sharma", optin_category: "double_confirmed", optin_source: "whatsapp_optin", optin_timestamp: "2026-04-22T08:00:00Z", tier_tag: "VIP", last_message_at: "2026-06-11T09:15:00Z", block_count: 0, custom_fields: { city: "Delhi", plan: "Enterprise" }, extraData: {} },
  { id: "3", phone: "+919900000003", name: "Kabir Singh", optin_category: "utility_only", optin_source: "inbound_msg", optin_timestamp: "2026-06-01T16:45:00Z", tier_tag: "Regular", last_message_at: "2026-06-08T11:30:00Z", block_count: 1, custom_fields: { city: "Pune" }, extraData: {} },
  { id: "4", phone: "+919900000004", name: "Ananya Verma", optin_category: "marketing", optin_source: "csv_import", optin_timestamp: "2026-05-28T12:00:00Z", tier_tag: "New", last_message_at: "2026-06-09T16:00:00Z", block_count: 0, custom_fields: { city: "Bangalore", plan: "Starter" }, extraData: {} },
  { id: "5", phone: "+919900000005", name: "Rohan Gupta", optin_category: "opted_out", optin_source: "whatsapp_optin", optin_timestamp: "2026-03-10T09:00:00Z", tier_tag: "Regular", last_message_at: "2026-05-20T10:00:00Z", block_count: 3, custom_fields: { city: "Chennai" }, extraData: {} },
  { id: "6", phone: "+919900000006", name: "Priya Nair", optin_category: "marketing", optin_source: "website_form", optin_timestamp: "2026-06-05T14:30:00Z", tier_tag: "New", last_message_at: "2026-06-12T08:45:00Z", block_count: 0, custom_fields: { city: "Hyderabad", plan: "Premium" }, extraData: {} },
  { id: "7", phone: "+919900000007", name: "Vikram Joshi", optin_category: "none", optin_source: "", tier_tag: "New", block_count: 0, custom_fields: { city: "Kolkata" }, extraData: {} },
  { id: "8", phone: "+919900000008", name: "Sneha Reddy", optin_category: "marketing", optin_source: "inbound_msg", optin_timestamp: "2026-05-20T11:00:00Z", tier_tag: "Regular", last_message_at: "2026-06-07T13:20:00Z", block_count: 0, custom_fields: { city: "Mumbai", plan: "Starter" }, extraData: {} },
  { id: "9", phone: "+919900000009", name: "Arjun Kumar", optin_category: "utility_only", optin_source: "inbound_msg", optin_timestamp: "2026-06-10T09:30:00Z", tier_tag: "New", last_message_at: "2026-06-10T09:30:00Z", block_count: 0, custom_fields: { city: "Jaipur" }, extraData: {} },
  { id: "10", phone: "+919900000010", name: "Meera Iyer", optin_category: "double_confirmed", optin_source: "whatsapp_optin", optin_timestamp: "2026-04-01T07:00:00Z", tier_tag: "VIP", last_message_at: "2026-06-12T10:00:00Z", block_count: 0, custom_fields: { city: "Pune", plan: "Enterprise" }, extraData: {} },
];

const mockSegments: Segment[] = [
  { id: "s1", name: "VIP Customers", filter_query: "tier_tag = 'VIP'", contact_count: 1240, created_at: "2026-05-01" },
  { id: "s2", name: "Marketing Opt-in", filter_query: "optin_category IN ('marketing', 'double_confirmed')", contact_count: 8340, created_at: "2026-05-10" },
  { id: "s3", name: "New Users (7d)", filter_query: "created_at > NOW() - INTERVAL '7 days'", contact_count: 432, created_at: "2026-06-01" },
  { id: "s4", name: "Inactive 30d+", filter_query: "last_message_at < NOW() - INTERVAL '30 days'", contact_count: 2100, created_at: "2026-06-05" },
  { id: "s5", name: "High Block Risk", filter_query: "block_count >= 2", contact_count: 89, created_at: "2026-06-08" },
];

function optinBadge(category: OptinCategory) {
  const config: Record<OptinCategory, { bg: string; text: string; border: string; label: string }> = {
    none: { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200", label: "None" },
    utility_only: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", label: "Utility" },
    marketing: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", label: "Marketing" },
    double_confirmed: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Confirmed" },
    opted_out: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", label: "Opted Out" },
  };
  const c = config[category];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${c.bg} ${c.text} ${c.border}`}>
      {category === "opted_out" && <AlertTriangle size={9} />}
      {category === "double_confirmed" && <CheckCircle2 size={9} />}
      {c.label}
    </span>
  );
}

function tierBadge(tier: Contact["tier_tag"]) {
  const map = {
    VIP: "bg-amber-50 text-amber-700 border-amber-200",
    Regular: "bg-gray-100 text-gray-600 border-gray-200",
    New: "bg-blue-50 text-blue-600 border-blue-200",
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${map[tier]}`}>
      {tier}
    </span>
  );
}

export default function DatabasePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOptin, setFilterOptin] = useState<OptinCategory | "all">("all");
  const [filterTier, setFilterTier] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"contacts" | "segments">("contacts");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [showSegmentBuilder, setShowSegmentBuilder] = useState(false);

  const filteredContacts = mockContacts.filter((c) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!c.phone.includes(q) && !(c.name?.toLowerCase().includes(q))) return false;
    }
    if (filterOptin !== "all" && c.optin_category !== filterOptin) return false;
    if (filterTier !== "all" && c.tier_tag !== filterTier) return false;
    return true;
  });

  function toggleContact(id: string) {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map((c) => c.id)));
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Database</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage contacts, segments, and opt-in states.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Upload size={14} /> Import CSV
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab("contacts")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "contacts" ? "border-purple-600 text-purple-600" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users size={14} className="inline mr-1.5 -mt-0.5" />
          Contacts ({mockContacts.length.toLocaleString()})
        </button>
        <button
          onClick={() => setActiveTab("segments")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "segments" ? "border-purple-600 text-purple-600" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Filter size={14} className="inline mr-1.5 -mt-0.5" />
          Segments ({mockSegments.length})
        </button>
      </div>

      {activeTab === "contacts" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or phone..."
                className="h-9 w-full rounded-lg border border-border bg-white pl-8 pr-3 text-sm outline-none focus:border-purple-500"
              />
            </div>
            <select
              value={filterOptin}
              onChange={(e) => setFilterOptin(e.target.value as OptinCategory | "all")}
              className="h-9 rounded-lg border border-border bg-white px-3 text-sm font-medium outline-none"
            >
              <option value="all">All Opt-in States</option>
              <option value="none">None</option>
              <option value="utility_only">Utility Only</option>
              <option value="marketing">Marketing</option>
              <option value="double_confirmed">Double Confirmed</option>
              <option value="opted_out">Opted Out</option>
            </select>
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
              className="h-9 rounded-lg border border-border bg-white px-3 text-sm font-medium outline-none"
            >
              <option value="all">All Tiers</option>
              <option value="VIP">VIP</option>
              <option value="Regular">Regular</option>
              <option value="New">New</option>
            </select>
          </div>

          {/* Bulk actions */}
          {selectedContacts.size > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2.5">
              <span className="text-sm font-semibold text-purple-700">{selectedContacts.size} selected</span>
              <div className="flex gap-2 ml-auto">
                <button className="inline-flex items-center gap-1 rounded-md bg-white border border-purple-200 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100">
                  <Tag size={12} /> Add Tag
                </button>
                <button className="inline-flex items-center gap-1 rounded-md bg-white border border-purple-200 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100">
                  <Edit3 size={12} /> Update Field
                </button>
                <button className="inline-flex items-center gap-1 rounded-md bg-white border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          )}

          {/* Contacts table */}
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedContacts.size === filteredContacts.length && filteredContacts.length > 0}
                        onChange={toggleAll}
                        className="size-3.5 rounded accent-purple-600"
                      />
                    </th>
                    <th className="px-4 py-3 text-left">Phone</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-center">Opt-in</th>
                    <th className="px-4 py-3 text-center">Tier</th>
                    <th className="px-4 py-3 text-right">Last Message</th>
                    <th className="px-4 py-3 text-right">Blocks</th>
                    <th className="px-4 py-3 text-left">Custom Fields</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredContacts.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedContacts.has(c.id)}
                          onChange={() => toggleContact(c.id)}
                          className="size-3.5 rounded accent-purple-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">{c.phone}</td>
                      <td className="px-4 py-3 font-medium">{c.name || "—"}</td>
                      <td className="px-4 py-3 text-center">{optinBadge(c.optin_category)}</td>
                      <td className="px-4 py-3 text-center">{tierBadge(c.tier_tag)}</td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {c.last_message_at
                          ? new Date(c.last_message_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {c.block_count > 0 ? (
                          <span className="text-xs font-bold text-red-600">{c.block_count}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(c.custom_fields).slice(0, 3).map(([k, v]) => (
                            <span key={k} className="inline-flex rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {k}: {v}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "segments" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowSegmentBuilder(!showSegmentBuilder)}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 transition-colors"
            >
              <Plus size={14} /> Create Segment
            </button>
          </div>

          {showSegmentBuilder && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Segment Builder</h3>
                <button onClick={() => setShowSegmentBuilder(false)} className="p-1 hover:bg-white rounded text-muted-foreground">
                  <X size={14} />
                </button>
              </div>
              <input
                placeholder="Segment name..."
                className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-purple-500"
              />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <select className="h-9 rounded-lg border border-border bg-white px-3 text-sm flex-1">
                    <option>optin_category</option>
                    <option>tier_tag</option>
                    <option>last_message_at</option>
                    <option>block_count</option>
                  </select>
                  <select className="h-9 rounded-lg border border-border bg-white px-3 text-sm w-24">
                    <option>=</option>
                    <option>!=</option>
                    <option>&gt;</option>
                    <option>&lt;</option>
                    <option>IN</option>
                  </select>
                  <input
                    placeholder="value"
                    className="h-9 flex-1 rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-purple-500"
                  />
                </div>
                <button className="text-xs font-semibold text-purple-600 hover:text-purple-700">
                  + Add condition (AND)
                </button>
              </div>
              <button className="h-9 rounded-lg bg-purple-600 px-4 text-sm font-semibold text-white hover:bg-purple-700">
                Save Segment
              </button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mockSegments.map((seg) => (
              <div key={seg.id} className="rounded-xl border border-border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">{seg.name}</h3>
                  <span className="text-lg font-bold text-purple-600">{seg.contact_count.toLocaleString()}</span>
                </div>
                <p className="mt-2 text-[11px] font-mono text-muted-foreground bg-muted rounded px-2 py-1">{seg.filter_query}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    Created {new Date(seg.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                  </span>
                  <button className="text-[10px] font-semibold text-purple-600 hover:text-purple-700">
                    Use in Campaign
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white border border-border shadow-xl p-6 space-y-4 mx-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Import Contacts</h2>
              <button onClick={() => setShowImport(false)} className="p-1 hover:bg-muted rounded text-muted-foreground">
                <X size={18} />
              </button>
            </div>
            <label className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-purple-400 hover:bg-purple-50/50 transition-colors">
              <Upload size={28} className="text-purple-400 mb-2" />
              <span className="text-sm font-semibold text-foreground">Drop CSV here or click to browse</span>
              <span className="text-xs text-muted-foreground mt-1">Must include phone column (E.164 format)</span>
              <input type="file" accept=".csv" className="sr-only" />
            </label>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-700">Required columns:</p>
              <p className="text-[11px] text-amber-600 mt-1">phone (E.164), optin_source. Optional: name, tier_tag, custom fields.</p>
              <p className="text-[11px] text-amber-600 mt-1">Duplicates will be merged by phone number.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowImport(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
                Cancel
              </button>
              <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">
                Upload & Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
