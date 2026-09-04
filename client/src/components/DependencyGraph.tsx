import { useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { humanArtifactType, humanRelationshipLabel } from "../api/client.ts";
import type { GraphEdgeDto, GraphNodeDto } from "../types/index.ts";

interface GraphNodeData extends Record<string, unknown> {
  kindLabel: string;
  name: string;
  mono: boolean;
  glyph: string;
  visual: "clause" | "artifact" | "affected";
  dimmed: boolean;
}

function GraphNode({ data }: NodeProps<Node<GraphNodeData>>) {
  const surface =
    data.visual === "clause"
      ? "border-[#174C3C]/30"
      : data.visual === "affected"
        ? "border-[#D98B37] bg-[#FBF3EA]"
        : "border-[#E6E7E4]";
  const icon =
    data.visual === "clause"
      ? "bg-[#174C3C] text-white"
      : data.visual === "affected"
        ? "bg-[#D98B37] text-white"
        : "bg-stone-100 text-stone-500";
  return (
    <div
      className={`w-[220px] rounded-xl border bg-white px-3 py-2.5 shadow-none ${surface} ${
        data.dimmed ? "opacity-30" : ""
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-stone-300" />
      <div className="flex items-start gap-2">
        <span
          aria-hidden="true"
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-semibold ${icon}`}
        >
          {data.glyph}
        </span>
        <span className="min-w-0">
          <span className="block text-[10.5px] font-medium text-stone-500">{data.kindLabel}</span>
          <span
            className={`block truncate text-[13.5px] font-semibold text-stone-800 ${
              data.mono ? "font-mono text-[12px]" : ""
            }`}
            title={data.name}
          >
            {data.name}
          </span>
        </span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-stone-300" />
    </div>
  );
}

const nodeTypes = { policyNode: GraphNode };

interface DependencyGraphProps {
  nodes: GraphNodeDto[];
  edges: GraphEdgeDto[];
  selectedNodeIds?: string[];
  selectedEdgeIds?: string[];
  affectedNodeId?: string | null;
  heightClassName?: string;
}

function glyphFor(node: GraphNodeDto): string {
  if (node.nodeType === "CLAUSE") return "§";
  if (node.artifactType === "FORM") return "▤";
  if (node.artifactType === "PROCEDURE") return "☰";
  return "</>";
}

function kindLabelFor(node: GraphNodeDto): string {
  if (node.nodeType === "CLAUSE") return "Policy clause";
  return humanArtifactType(node.artifactType ?? "FORM");
}

/** Layered layout: clause nodes in column 0, each hop one column right. */
function layoutColumns(nodes: GraphNodeDto[], edges: GraphEdgeDto[]): Map<string, number> {
  const distance = new Map<string, number>();
  const queue: string[] = [];
  for (const node of nodes) {
    if (node.nodeType === "CLAUSE") {
      distance.set(node.id, 0);
      queue.push(node.id);
    }
  }
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.sourceNodeId) ?? [];
    list.push(edge.targetNodeId);
    outgoing.set(edge.sourceNodeId, list);
  }
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++] as string;
    const depth = distance.get(current) ?? 0;
    for (const next of outgoing.get(current) ?? []) {
      if (!distance.has(next)) {
        distance.set(next, depth + 1);
        queue.push(next);
      }
    }
  }
  // Nodes unreachable from any clause (e.g. disconnected) sit in column 0.
  for (const node of nodes) {
    if (!distance.has(node.id)) distance.set(node.id, 0);
  }
  return distance;
}

export default function DependencyGraph({
  nodes,
  edges,
  selectedNodeIds = [],
  selectedEdgeIds = [],
  affectedNodeId = null,
  heightClassName = "h-[420px]",
}: DependencyGraphProps) {
  const { flowNodes, flowEdges } = useMemo(() => {
    const hasSelection = selectedNodeIds.length > 0 || selectedEdgeIds.length > 0;
    const selectedNodes = new Set(selectedNodeIds);
    const selectedEdges = new Set(selectedEdgeIds);
    const columns = layoutColumns(nodes, edges);
    const byColumn = new Map<number, GraphNodeDto[]>();
    for (const node of nodes) {
      const col = columns.get(node.id) ?? 0;
      const list = byColumn.get(col) ?? [];
      list.push(node);
      byColumn.set(col, list);
    }

    const flowNodes: Node<GraphNodeData>[] = [];
    for (const [col, list] of [...byColumn.entries()].sort((a, b) => a[0] - b[0])) {
      list
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((node, row) => {
          const visual =
            node.id === affectedNodeId ? "affected" : node.nodeType === "CLAUSE" ? "clause" : "artifact";
          const dimmed = hasSelection && !selectedNodes.has(node.id);
          flowNodes.push({
            id: node.id,
            type: "policyNode",
            position: { x: 24 + col * 280, y: 24 + row * 132 },
            data: {
              kindLabel: kindLabelFor(node),
              name: node.name,
              mono: node.nodeType === "CLAUSE",
              glyph: glyphFor(node),
              visual,
              dimmed,
            },
            selectable: false,
            draggable: true,
          });
        });
    }

    const flowEdges: Edge[] = edges.map((edge) => {
      const approved = edge.status === "APPROVED";
      const onPath = selectedEdges.has(edge.id);
      return {
        id: edge.id,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        label: humanRelationshipLabel(edge.relationshipType, edge.relationshipLabel),
        animated: false,
        style: {
          stroke: onPath ? "#174C3C" : "#A8A29E",
          strokeWidth: onPath ? 2.5 : 1.5,
          strokeDasharray: approved ? undefined : "5 4",
          opacity: hasSelection && !onPath ? 0.25 : 1,
        },
        labelStyle: {
          fontSize: 11,
          fill: onPath ? "#174C3C" : "#57534E",
          fontWeight: onPath ? 700 : 500,
        },
        labelBgStyle: { fill: "#F7F7F5" },
        labelShowBg: true,
      };
    });
    return { flowNodes, flowEdges };
  }, [nodes, edges, selectedNodeIds, selectedEdgeIds, affectedNodeId]);

  if (nodes.length === 0) {
    return (
      <div
        className={`flex ${heightClassName} items-center justify-center rounded-xl border border-[#E6E7E4] bg-[#F7F7F5]`}
      >
        <p className="text-sm text-stone-500">No dependency graph available.</p>
      </div>
    );
  }

  return (
    <div
      className={`${heightClassName} overflow-hidden rounded-xl border border-[#E6E7E4] bg-[#F7F7F5]`}
      role="img"
      aria-label={`Dependency graph with ${nodes.length} nodes and ${edges.length} relationships. A textual path is listed beside the graph.`}
    >
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: false }}
        minZoom={0.4}
        maxZoom={1.5}
      >
        <Background color="#D6D3D1" gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
