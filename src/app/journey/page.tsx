"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  type Connection,
  type Node,
  type Edge,
  MarkerType,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  MessageSquare, Zap, GitBranch, Clock, Send, Tag, Webhook, Shield, CheckCircle2,
  MessageCircle, Timer, QrCode, UserPlus, Settings2, Save, Play, Pause, ChevronRight, X,
  Loader2, FolderOpen, Plus, Trash2, Plug, AlertTriangle,
} from "lucide-react";
import type { JourneyNodeType } from "@/lib/types";
import { useApp } from "@/lib/AppContext";
import { supabase } from "@/lib/supabase";

type NodeCategory = "trigger" | "action" | "condition" | "wait";
type DBConnector = { id: string; name: string; type: string };

const nodeDefinitions: { type: JourneyNodeType; label: string; icon: typeof Zap; category: NodeCategory; color: string }[] = [
  { type: "trigger_inbound", label: "Inbound Message", icon: MessageSquare, category: "trigger", color: "#7c3aed" },
  { type: "trigger_click_wa", label: "Click-to-WA / QR", icon: QrCode, category: "trigger", color: "#7c3aed" },
  { type: "trigger_api_event", label: "API Event", icon: Zap, category: "trigger", color: "#7c3aed" },
  { type: "trigger_segment", label: "Added to Segment", icon: UserPlus, category: "trigger", color: "#7c3aed" },
  { type: "action_send_template", label: "Send Template", icon: Send, category: "action", color: "#2563eb" },
  { type: "action_send_reply", label: "Send Reply (24h)", icon: MessageCircle, category: "action", color: "#2563eb" },
  { type: "action_add_tag", label: "Add Tag", icon: Tag, category: "action", color: "#2563eb" },
  { type: "action_remove_tag", label: "Remove Tag", icon: Tag, category: "action", color: "#2563eb" },
  { type: "action_update_field", label: "Update Field", icon: Settings2, category: "action", color: "#2563eb" },
  { type: "action_trigger_webhook", label: "Trigger Webhook", icon: Webhook, category: "action", color: "#2563eb" },
  { type: "condition_optin", label: "Opt-in Gate", icon: Shield, category: "condition", color: "#d97706" },
  { type: "condition_delivered", label: "Message Delivered?", icon: CheckCircle2, category: "condition", color: "#d97706" },
  { type: "condition_replied", label: "User Replied?", icon: MessageCircle, category: "condition", color: "#d97706" },
  { type: "condition_time", label: "Time Condition", icon: Timer, category: "condition", color: "#d97706" },
  { type: "condition_field", label: "Field Value", icon: GitBranch, category: "condition", color: "#d97706" },
  { type: "wait_delay", label: "Delay", icon: Clock, category: "wait", color: "#059669" },
  { type: "wait_event", label: "Wait for Event", icon: Timer, category: "wait", color: "#059669" },
];

const categoryLabels: Record<NodeCategory, string> = { trigger: "Triggers", action: "Actions", condition: "Conditions", wait: "Wait" };
const categoryColors: Record<NodeCategory, string> = { trigger: "#7c3aed", action: "#2563eb", condition: "#d97706", wait: "#059669" };
const bgColors: Record<NodeCategory, string> = { trigger: "#f5f3ff", action: "#eff6ff", condition: "#fffbeb", wait: "#ecfdf5" };

function makeNodeStyle(cat: NodeCategory, color: string) {
  return { background: bgColors[cat], border: `2px solid ${color}`, borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 600, minWidth: 180 };
}

const starterNodes: Node[] = [
  { id: "1", type: "default", position: { x: 250, y: 50 }, data: { label: "Inbound Message", nodeType: "trigger_inbound" }, style: makeNodeStyle("trigger", "#7c3aed") },
  { id: "2", type: "default", position: { x: 250, y: 180 }, data: { label: "Send Opt-in Request", nodeType: "action_send_template" }, style: makeNodeStyle("action", "#2563eb") },
  { id: "3", type: "default", position: { x: 250, y: 310 }, data: { label: "User Replied Yes?", nodeType: "condition_replied" }, style: makeNodeStyle("condition", "#d97706") },
  { id: "4", type: "default", position: { x: 80, y: 450 }, data: { label: "Set Optin: Marketing", nodeType: "action_update_field" }, style: makeNodeStyle("action", "#2563eb") },
  { id: "5", type: "default", position: { x: 420, y: 450 }, data: { label: "Set Optin: Utility Only", nodeType: "action_update_field" }, style: makeNodeStyle("action", "#2563eb") },
  { id: "6", type: "default", position: { x: 80, y: 580 }, data: { label: "Send Welcome Msg", nodeType: "action_send_template" }, style: makeNodeStyle("action", "#2563eb") },
];
const starterEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", animated: true, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#7c3aed" } },
  { id: "e2-3", source: "2", target: "3", animated: true, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#2563eb" } },
  { id: "e3-4", source: "3", target: "4", label: "Yes", markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#059669" } },
  { id: "e3-5", source: "3", target: "5", label: "No", markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#ef4444" } },
  { id: "e4-6", source: "4", target: "6", animated: true, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#2563eb" } },
];

type DBJourney = { id: string; name: string; status: string; definition: unknown; created_at: string };

export default function JourneyPage() {
  const { userId, dbStatus } = useApp();
  const [nodes, setNodes, onNodesChange] = useNodesState(starterNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(starterEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [journeyName, setJourneyName] = useState("Opt-in Capture Flow");
  const [journeyStatus, setJourneyStatus] = useState<"draft" | "active" | "paused">("draft");
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const idCounter = useRef(7);

  const [savedJourneys, setSavedJourneys] = useState<DBJourney[]>([]);
  const [showList, setShowList] = useState(false);
  const [connectors, setConnectors] = useState<DBConnector[]>([]);

  const flash = useCallback((t: "ok" | "err", text: string) => { setNotice({ type: t, text }); setTimeout(() => setNotice(null), 3500); }, []);

  useEffect(() => {
    if (!supabase || !userId) return;
    supabase.from("connectors").select("id, name, type").eq("user_id", userId).eq("status", "active").then(({ data }) => {
      if (data) setConnectors(data);
    });
  }, [userId]);

  async function loadJourneyList() {
    if (!supabase || !userId) return;
    const { data } = await supabase.from("journeys").select("id, name, status, definition, created_at").eq("user_id", userId).order("created_at", { ascending: false });
    if (data) setSavedJourneys(data as DBJourney[]);
    setShowList(true);
  }

  function openJourney(j: DBJourney) {
    const def = j.definition as { nodes?: Node[]; edges?: Edge[] } | null;
    setJourneyId(j.id);
    setJourneyName(j.name);
    setJourneyStatus(j.status as "draft" | "active" | "paused");
    setNodes(def?.nodes ?? []);
    setEdges(def?.edges ?? []);
    setShowList(false);
    setSelectedNode(null);
    const maxId = (def?.nodes ?? []).reduce((m, n) => Math.max(m, parseInt(n.id) || 0), 0);
    idCounter.current = maxId + 1;
  }

  function newJourney() {
    setJourneyId(null);
    setJourneyName("New Journey");
    setJourneyStatus("draft");
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    idCounter.current = 1;
    setShowList(false);
  }

  async function saveJourney() {
    if (!supabase || !userId) return;
    setSaving(true);
    const definition = { nodes, edges };
    if (journeyId) {
      const { error } = await supabase.from("journeys").update({ name: journeyName, status: journeyStatus, definition }).eq("id", journeyId);
      if (error) flash("err", error.message); else flash("ok", "Journey saved!");
    } else {
      const { data, error } = await supabase.from("journeys").insert({ user_id: userId, name: journeyName, status: journeyStatus, definition }).select("id").single();
      if (error) flash("err", error.message);
      else { setJourneyId(data.id); flash("ok", "Journey created!"); }
    }
    setSaving(false);
  }

  async function deleteJourney(id: string) {
    if (!supabase) return;
    await supabase.from("journeys").delete().eq("id", id);
    setSavedJourneys((p) => p.filter((j) => j.id !== id));
    if (journeyId === id) newJourney();
    flash("ok", "Journey deleted");
  }

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, animated: true, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#94a3b8" } }, eds));
    },
    [setEdges],
  );

  function onNodeClick(_: React.MouseEvent, node: Node) { setSelectedNode(node); }

  function addNodeToCanvas(def: typeof nodeDefinitions[number]) {
    const id = String(idCounter.current++);
    const newNode: Node = {
      id, type: "default",
      position: { x: 250 + Math.random() * 100, y: 100 + nodes.length * 80 },
      data: { label: def.label, nodeType: def.type, connectorId: "" },
      style: makeNodeStyle(def.category, def.color),
    };
    setNodes((nds) => [...nds, newNode]);
  }

  function updateNodeData(nodeId: string, key: string, value: string) {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, [key]: value } } : n));
    setSelectedNode((prev) => prev && prev.id === nodeId ? { ...prev, data: { ...prev.data, [key]: value } } : prev);
  }

  // Journey list modal
  if (showList) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Saved Journeys</h1>
          <div className="flex gap-2">
            <button onClick={newJourney} className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">
              <Plus size={14} /> New Journey
            </button>
            <button onClick={() => setShowList(false)} className="p-2 rounded-lg hover:bg-muted"><X size={18} /></button>
          </div>
        </div>
        {savedJourneys.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed p-12 text-center">
            <GitBranch size={36} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No journeys saved yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {savedJourneys.map((j) => (
              <div key={j.id} className="flex items-center justify-between rounded-lg border bg-white p-4 hover:border-purple-200 transition">
                <button onClick={() => openJourney(j)} className="flex-1 text-left">
                  <p className="font-semibold text-sm">{j.name}</p>
                  <p className="text-[11px] text-muted-foreground">{j.status} · {new Date(j.created_at).toLocaleDateString()}</p>
                </button>
                <button onClick={() => deleteJourney(j.id)} className="p-2 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {notice && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-lg ${notice.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
          {notice.type === "ok" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {notice.text}
        </div>
      )}

      {/* Left panel - Node palette */}
      <div className="w-[240px] shrink-0 border-r border-border bg-white overflow-y-auto">
        <div className="px-4 py-4 border-b border-border">
          <input value={journeyName} onChange={(e) => setJourneyName(e.target.value)}
            className="w-full text-sm font-bold outline-none border-b border-transparent focus:border-purple-500 pb-1" />
          <div className="flex items-center gap-2 mt-2">
            <span className={`size-2 rounded-full ${journeyStatus === "active" ? "bg-emerald-500" : journeyStatus === "paused" ? "bg-amber-500" : "bg-gray-400"}`} />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">{journeyStatus}</span>
            {journeyId && <span className="text-[9px] text-muted-foreground ml-auto">ID: {journeyId.slice(0, 8)}</span>}
          </div>
        </div>

        <div className="p-3 space-y-4">
          {(["trigger", "action", "condition", "wait"] as NodeCategory[]).map((cat) => (
            <div key={cat}>
              <p className="text-[10px] font-bold uppercase tracking-wider px-1 mb-1.5" style={{ color: categoryColors[cat] }}>
                {categoryLabels[cat]}
              </p>
              <div className="space-y-1">
                {nodeDefinitions.filter((n) => n.category === cat).map((def) => (
                  <button key={def.type} onClick={() => addNodeToCanvas(def)}
                    className="w-full flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-xs font-medium text-foreground/80 hover:bg-muted hover:border-purple-200 transition-colors">
                    <def.icon size={14} style={{ color: def.color }} className="shrink-0" />
                    {def.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect} onNodeClick={onNodeClick} fitView className="bg-gray-50">
          <Controls position="bottom-left" />
          <MiniMap position="bottom-right" nodeColor={(n) => {
            const nt = (n.data as { nodeType?: string }).nodeType ?? "";
            if (nt.startsWith("trigger")) return "#7c3aed";
            if (nt.startsWith("action")) return "#2563eb";
            if (nt.startsWith("condition")) return "#d97706";
            return "#059669";
          }} style={{ borderRadius: 8 }} />
          <Background gap={20} size={1} color="#e2e8f0" />

          <Panel position="top-right">
            <div className="flex items-center gap-2 bg-white rounded-lg border shadow-sm p-1.5">
              {dbStatus === "connected" && (
                <button onClick={loadJourneyList}
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors">
                  <FolderOpen size={12} /> Open
                </button>
              )}
              <button onClick={() => setJourneyStatus(journeyStatus === "active" ? "paused" : "active")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${journeyStatus === "active" ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}>
                {journeyStatus === "active" ? <Pause size={12} /> : <Play size={12} />}
                {journeyStatus === "active" ? "Pause" : "Activate"}
              </button>
              {dbStatus === "connected" && (
                <button onClick={saveJourney} disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-60">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                </button>
              )}
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Right panel - Node config */}
      {selectedNode && (
        <div className="w-[300px] shrink-0 border-l border-border bg-white overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-bold">Configure Node</h3>
            <button onClick={() => setSelectedNode(null)} className="p-1 rounded hover:bg-muted text-muted-foreground"><X size={14} /></button>
          </div>
          <div className="p-4 space-y-4">
            <label className="block text-xs font-semibold text-muted-foreground">
              Label
              <input value={String(selectedNode.data.label ?? "")}
                onChange={(e) => updateNodeData(selectedNode.id, "label", e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
            </label>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Type</p>
              <p className="text-sm font-medium">{String(selectedNode.data.nodeType ?? "default")}</p>
            </div>

            {/* Connector selector for send nodes */}
            {String(selectedNode.data.nodeType ?? "").startsWith("action_send") && (
              <>
                <label className="block text-xs font-semibold text-muted-foreground">
                  <span className="flex items-center gap-1"><Plug size={11} /> Connector</span>
                  {connectors.length === 0 ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">No active connectors. <a href="/connectors" className="text-purple-600 hover:underline">Add one</a></p>
                  ) : (
                    <select value={String(selectedNode.data.connectorId ?? "")}
                      onChange={(e) => updateNodeData(selectedNode.id, "connectorId", e.target.value)}
                      className="mt-1 h-9 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500">
                      <option value="">Auto (default connector)</option>
                      {connectors.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type.replace("_", " ")})</option>)}
                    </select>
                  )}
                </label>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Template Name
                  <input value={String(selectedNode.data.templateName ?? "")}
                    onChange={(e) => updateNodeData(selectedNode.id, "templateName", e.target.value)}
                    placeholder="e.g. welcome_msg"
                    className="mt-1 h-9 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
                </label>
              </>
            )}

            {/* Webhook URL */}
            {String(selectedNode.data.nodeType ?? "") === "action_trigger_webhook" && (
              <label className="block text-xs font-semibold text-muted-foreground">
                Webhook URL
                <input value={String(selectedNode.data.webhookUrl ?? "")}
                  onChange={(e) => updateNodeData(selectedNode.id, "webhookUrl", e.target.value)}
                  placeholder="https://..."
                  className="mt-1 h-9 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
              </label>
            )}

            {/* Tag name */}
            {(String(selectedNode.data.nodeType ?? "").includes("add_tag") || String(selectedNode.data.nodeType ?? "").includes("remove_tag")) && (
              <label className="block text-xs font-semibold text-muted-foreground">
                Tag Name
                <input value={String(selectedNode.data.tagName ?? "")}
                  onChange={(e) => updateNodeData(selectedNode.id, "tagName", e.target.value)}
                  placeholder="e.g. vip_customer"
                  className="mt-1 h-9 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
              </label>
            )}

            {/* Update field */}
            {String(selectedNode.data.nodeType ?? "") === "action_update_field" && (
              <>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Field
                  <input value={String(selectedNode.data.fieldName ?? "")}
                    onChange={(e) => updateNodeData(selectedNode.id, "fieldName", e.target.value)}
                    placeholder="e.g. optin_category"
                    className="mt-1 h-9 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
                </label>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Value
                  <input value={String(selectedNode.data.fieldValue ?? "")}
                    onChange={(e) => updateNodeData(selectedNode.id, "fieldValue", e.target.value)}
                    placeholder="e.g. marketing"
                    className="mt-1 h-9 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
                </label>
              </>
            )}

            {String(selectedNode.data.nodeType ?? "").startsWith("condition") && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-bold text-amber-700">Branch Paths</p>
                <div className="mt-2 space-y-1 text-xs text-amber-600">
                  <p className="flex items-center gap-1"><ChevronRight size={10} /> Yes → connect to next node</p>
                  <p className="flex items-center gap-1"><ChevronRight size={10} /> No → connect to alternate path</p>
                </div>
              </div>
            )}

            {String(selectedNode.data.nodeType ?? "") === "wait_delay" && (
              <label className="block text-xs font-semibold text-muted-foreground">
                Delay
                <div className="flex gap-2 mt-1">
                  <input type="number" value={String(selectedNode.data.delayAmount ?? "1")}
                    onChange={(e) => updateNodeData(selectedNode.id, "delayAmount", e.target.value)}
                    min={1} className="h-9 w-20 rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
                  <select value={String(selectedNode.data.delayUnit ?? "hours")}
                    onChange={(e) => updateNodeData(selectedNode.id, "delayUnit", e.target.value)}
                    className="h-9 flex-1 rounded-lg border px-3 text-sm outline-none focus:border-purple-500">
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              </label>
            )}

            {String(selectedNode.data.nodeType ?? "") === "condition_optin" && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                <p className="text-xs font-bold text-purple-700">Opt-in Gate</p>
                <p className="mt-1 text-[11px] text-purple-600">
                  Blocks marketing messages if contact opt-in is not &apos;marketing&apos; or &apos;double_confirmed&apos;.
                </p>
              </div>
            )}

            {String(selectedNode.data.nodeType ?? "") === "condition_field" && (
              <>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Field to Check
                  <input value={String(selectedNode.data.condField ?? "")}
                    onChange={(e) => updateNodeData(selectedNode.id, "condField", e.target.value)}
                    placeholder="e.g. tier_tag"
                    className="mt-1 h-9 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
                </label>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Expected Value
                  <input value={String(selectedNode.data.condValue ?? "")}
                    onChange={(e) => updateNodeData(selectedNode.id, "condValue", e.target.value)}
                    placeholder="e.g. gold"
                    className="mt-1 h-9 w-full rounded-lg border px-3 text-sm outline-none focus:border-purple-500" />
                </label>
              </>
            )}

            <button onClick={() => {
              setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
              setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
              setSelectedNode(null);
            }}
              className="w-full h-9 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50">
              Delete Node
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
