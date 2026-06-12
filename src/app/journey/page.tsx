"use client";

import { useState, useCallback, useRef } from "react";
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
  MessageSquare,
  Zap,
  GitBranch,
  Clock,
  Send,
  Tag,
  Webhook,
  Shield,
  CheckCircle2,
  MessageCircle,
  Timer,
  QrCode,
  UserPlus,
  Settings2,
  Plus,
  Save,
  Play,
  Pause,
  ChevronRight,
  X,
} from "lucide-react";
import type { JourneyNodeType } from "@/lib/types";

type NodeCategory = "trigger" | "action" | "condition" | "wait";

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

const categoryLabels: Record<NodeCategory, string> = {
  trigger: "Triggers",
  action: "Actions",
  condition: "Conditions",
  wait: "Wait",
};

const categoryColors: Record<NodeCategory, string> = {
  trigger: "#7c3aed",
  action: "#2563eb",
  condition: "#d97706",
  wait: "#059669",
};

const initialNodes: Node[] = [
  {
    id: "1",
    type: "default",
    position: { x: 250, y: 50 },
    data: { label: "Inbound Message", nodeType: "trigger_inbound" },
    style: { background: "#f5f3ff", border: "2px solid #7c3aed", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 600, minWidth: 180 },
  },
  {
    id: "2",
    type: "default",
    position: { x: 250, y: 180 },
    data: { label: "Send Opt-in Request", nodeType: "action_send_template" },
    style: { background: "#eff6ff", border: "2px solid #2563eb", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 600, minWidth: 180 },
  },
  {
    id: "3",
    type: "default",
    position: { x: 250, y: 310 },
    data: { label: "User Replied Yes?", nodeType: "condition_replied" },
    style: { background: "#fffbeb", border: "2px solid #d97706", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 600, minWidth: 180 },
  },
  {
    id: "4",
    type: "default",
    position: { x: 80, y: 450 },
    data: { label: "Set Optin: Marketing", nodeType: "action_update_field" },
    style: { background: "#eff6ff", border: "2px solid #2563eb", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 600, minWidth: 180 },
  },
  {
    id: "5",
    type: "default",
    position: { x: 420, y: 450 },
    data: { label: "Set Optin: Utility Only", nodeType: "action_update_field" },
    style: { background: "#eff6ff", border: "2px solid #2563eb", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 600, minWidth: 180 },
  },
  {
    id: "6",
    type: "default",
    position: { x: 80, y: 580 },
    data: { label: "Send Welcome Msg", nodeType: "action_send_template" },
    style: { background: "#eff6ff", border: "2px solid #2563eb", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 600, minWidth: 180 },
  },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", animated: true, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#7c3aed" } },
  { id: "e2-3", source: "2", target: "3", animated: true, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#2563eb" } },
  { id: "e3-4", source: "3", target: "4", label: "Yes", markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#059669" } },
  { id: "e3-5", source: "3", target: "5", label: "No", markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#ef4444" } },
  { id: "e4-6", source: "4", target: "6", animated: true, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#2563eb" } },
];

export default function JourneyPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [journeyName, setJourneyName] = useState("Opt-in Capture Flow");
  const [journeyStatus, setJourneyStatus] = useState<"draft" | "active" | "paused">("draft");
  const idCounter = useRef(7);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, animated: true, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#94a3b8" } }, eds));
    },
    [setEdges],
  );

  function onNodeClick(_: React.MouseEvent, node: Node) {
    setSelectedNode(node);
  }

  function addNodeToCanvas(def: typeof nodeDefinitions[number]) {
    const id = String(idCounter.current++);
    const bgColors: Record<NodeCategory, string> = {
      trigger: "#f5f3ff",
      action: "#eff6ff",
      condition: "#fffbeb",
      wait: "#ecfdf5",
    };
    const newNode: Node = {
      id,
      type: "default",
      position: { x: 250 + Math.random() * 100, y: 100 + nodes.length * 80 },
      data: { label: def.label, nodeType: def.type },
      style: {
        background: bgColors[def.category],
        border: `2px solid ${def.color}`,
        borderRadius: 12,
        padding: 12,
        fontSize: 13,
        fontWeight: 600,
        minWidth: 180,
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }

  return (
    <div className="flex h-screen">
      {/* Left panel - Node palette */}
      <div className="w-[240px] shrink-0 border-r border-border bg-white overflow-y-auto">
        <div className="px-4 py-4 border-b border-border">
          <input
            value={journeyName}
            onChange={(e) => setJourneyName(e.target.value)}
            className="w-full text-sm font-bold outline-none border-b border-transparent focus:border-purple-500 pb-1"
          />
          <div className="flex items-center gap-2 mt-2">
            <span className={`size-2 rounded-full ${journeyStatus === "active" ? "bg-emerald-500" : journeyStatus === "paused" ? "bg-amber-500" : "bg-gray-400"}`} />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">{journeyStatus}</span>
          </div>
        </div>

        <div className="p-3 space-y-4">
          {(["trigger", "action", "condition", "wait"] as NodeCategory[]).map((cat) => (
            <div key={cat}>
              <p className="text-[10px] font-bold uppercase tracking-wider px-1 mb-1.5" style={{ color: categoryColors[cat] }}>
                {categoryLabels[cat]}
              </p>
              <div className="space-y-1">
                {nodeDefinitions
                  .filter((n) => n.category === cat)
                  .map((def) => (
                    <button
                      key={def.type}
                      onClick={() => addNodeToCanvas(def)}
                      className="w-full flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted hover:border-purple-200"
                    >
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
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          fitView
          className="bg-gray-50"
        >
          <Controls position="bottom-left" />
          <MiniMap
            position="bottom-right"
            nodeColor={(n) => {
              const nt = (n.data as { nodeType?: string }).nodeType ?? "";
              if (nt.startsWith("trigger")) return "#7c3aed";
              if (nt.startsWith("action")) return "#2563eb";
              if (nt.startsWith("condition")) return "#d97706";
              return "#059669";
            }}
            style={{ borderRadius: 8 }}
          />
          <Background gap={20} size={1} color="#e2e8f0" />

          <Panel position="top-right">
            <div className="flex items-center gap-2 bg-white rounded-lg border border-border shadow-sm p-1.5">
              <button
                onClick={() => setJourneyStatus(journeyStatus === "active" ? "paused" : "active")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  journeyStatus === "active"
                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                    : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                }`}
              >
                {journeyStatus === "active" ? <Pause size={12} /> : <Play size={12} />}
                {journeyStatus === "active" ? "Pause" : "Activate"}
              </button>
              <button className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 transition-colors">
                <Save size={12} /> Save
              </button>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Right panel - Node config */}
      {selectedNode && (
        <div className="w-[280px] shrink-0 border-l border-border bg-white overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-bold">Node Config</h3>
            <button onClick={() => setSelectedNode(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
              <X size={14} />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <label className="block text-xs font-semibold text-muted-foreground">
              Label
              <input
                value={String(selectedNode.data.label ?? "")}
                onChange={(e) => {
                  setNodes((nds) =>
                    nds.map((n) =>
                      n.id === selectedNode.id ? { ...n, data: { ...n.data, label: e.target.value } } : n
                    )
                  );
                  setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, label: e.target.value } } : null);
                }}
                className="mt-1 h-9 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-purple-500"
              />
            </label>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Type</p>
              <p className="text-sm font-medium text-foreground">{String(selectedNode.data.nodeType ?? "default")}</p>
            </div>

            {String(selectedNode.data.nodeType ?? "").startsWith("action_send") && (
              <label className="block text-xs font-semibold text-muted-foreground">
                Template
                <select className="mt-1 h-9 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-purple-500">
                  <option>welcome_msg</option>
                  <option>promo_june</option>
                  <option>order_confirm</option>
                  <option>feedback_request</option>
                </select>
              </label>
            )}

            {String(selectedNode.data.nodeType ?? "").startsWith("condition") && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-bold text-amber-700">Branch Paths</p>
                <div className="mt-2 space-y-1 text-xs text-amber-600">
                  <p className="flex items-center gap-1"><ChevronRight size={10} /> Yes branch</p>
                  <p className="flex items-center gap-1"><ChevronRight size={10} /> No branch</p>
                </div>
              </div>
            )}

            {String(selectedNode.data.nodeType ?? "") === "wait_delay" && (
              <label className="block text-xs font-semibold text-muted-foreground">
                Delay Duration
                <div className="flex gap-2 mt-1">
                  <input type="number" defaultValue={1} min={1} className="h-9 w-20 rounded-lg border border-border px-3 text-sm outline-none focus:border-purple-500" />
                  <select className="h-9 flex-1 rounded-lg border border-border px-3 text-sm outline-none focus:border-purple-500">
                    <option>Hours</option>
                    <option>Days</option>
                  </select>
                </div>
              </label>
            )}

            {String(selectedNode.data.nodeType ?? "") === "condition_optin" && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                <p className="text-xs font-bold text-purple-700">Opt-in Gate</p>
                <p className="mt-1 text-[11px] text-purple-600">
                  Blocks downstream marketing nodes if contact.optin_category is not &apos;marketing&apos; or &apos;double_confirmed&apos;.
                </p>
              </div>
            )}

            <button
              onClick={() => {
                setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
                setSelectedNode(null);
              }}
              className="w-full h-9 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors"
            >
              Delete Node
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
