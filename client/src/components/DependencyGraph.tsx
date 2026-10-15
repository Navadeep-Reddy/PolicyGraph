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
import { humanRelationshipLabel } from "../api/client.ts";
import type { GraphEdge, GraphNode as GraphNodeType } from "../types/index.ts";

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
      ? "border-border-strong bg-glass-80"
      : data.visual === "affected"
        ? "border-accent bg-surface-2"
        : "border-border-faint bg-surface-white";
  const icon =
    data.visual === "clause"
      ? "bg-ink text-on-dark"
      : data.visual === "affected"
        ? "bg-accent text-on-dark"
        : "bg-surface-2 text-accent";
  return (
    <div
      className={`w-[220px] rounded-card border px-3 py-2.5 shadow-sm ${surface} ${
        data.dimmed ? "opacity-35" : ""
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-surface-4" />
      <div className="flex items-start gap-2">
        <span
          aria-hidden="true"
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-inner text-sm font-semibold ${icon}`}
        >
          {data.glyph}
        </span>
        <span className="min-w-0">
          <span className="type-label-sm block text-text-muted">{data.kindLabel}</span>
          <span
            className={`block truncate ${
              data.mono ? "type-micro-mono text-accent" : "text-sm font-semibold text-ink"
            }`}
            title={data.name}
          >
            {data.name}
          </span>
        </span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-surface-4" />
    </div>
  );
}

const nodeTypes = { policyNode: GraphNode };

interface DependencyGraphProps {
  nodes: GraphNodeType[];
  edges: GraphEdge[];
  selectedNodeIds?: string[];
  selectedEdgeIds?: string[];
  affectedNodeId?: string | null;
  heightClassName?: string;
}

function glyphFor(node: GraphNodeType): string {
  return node.type === "CLAUSE" ? "§" : "▤";
}

function kindLabelFor(node: GraphNodeType): string {
  return node.type === "CLAUSE" ? "Policy clause" : "Operational item";
}

/** Layered layout: clause nodes in column 0, each hop one column right. */
function layoutColumns(nodes: GraphNodeType[], edges: GraphEdge[]): Map<string, number> {
  const distance = new Map<string, number>();
  const queue: string[] = [];
  for (const node of nodes) {
    if (node.type === "CLAUSE") {
      distance.set(node.id, 0);
      queue.push(node.id);
    }
  }
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge.target);
    outgoing.set(edge.source, list);
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
    const byColumn = new Map<number, GraphNodeType[]>();
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
        .sort((a, b) => a.label.localeCompare(b.label))
        .forEach((node, row) => {
          const visual =
            node.id === affectedNodeId ? "affected" : node.type === "CLAUSE" ? "clause" : "artifact";
          const dimmed = hasSelection && !selectedNodes.has(node.id);
          flowNodes.push({
            id: node.id,
            type: "policyNode",
            position: { x: 24 + col * 280, y: 24 + row * 132 },
            data: {
              kindLabel: kindLabelFor(node),
              name: node.label,
              mono: node.type === "CLAUSE",
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
        source: edge.source,
        target: edge.target,
        label: humanRelationshipLabel(edge.relationshipType).toUpperCase(),
        animated: false,
        style: {
          stroke: "#36637C",
          strokeWidth: onPath ? 2.5 : 1.5,
          strokeDasharray: approved ? undefined : "5 4",
          opacity: hasSelection && !onPath ? 0.35 : approved ? 1 : 0.6,
        },
        // DESIGN.md §3.2 label-md: 11px, 600 weight, 0.14em tracking, uppercase.
        // Selection is shown through colour and opacity, never weight.
        labelStyle: {
          fontSize: 11,
          fill: onPath ? "#36637C" : "#75777D",
          fontWeight: 600,
          letterSpacing: "0.14em",
        },
        labelBgStyle: { fill: "#F5FAFF" },
        labelShowBg: true,
      };
    });
    return { flowNodes, flowEdges };
  }, [nodes, edges, selectedNodeIds, selectedEdgeIds, affectedNodeId]);

  if (nodes.length === 0) {
    return (
      <div
        className={`graph-canvas flex ${heightClassName} items-center justify-center rounded-card border border-border-default`}
      >
        <p className="type-body-md text-text-muted">No dependency graph available.</p>
      </div>
    );
  }

  return (
    <>
    <div
      className={`graph-canvas ${heightClassName} overflow-hidden rounded-card border border-border-default`}
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
        <Background color="rgba(54,99,124,0.08)" gap={24} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
    <div className="mt-3 overflow-x-auto rounded-card border border-border-default bg-glass-90">
      <table className="w-full min-w-[520px] border-collapse text-left">
        <caption className="sr-only">Text equivalent of dependency graph relationships</caption>
        <thead><tr className="border-b border-border-strong"><th className="type-label-md px-3 py-2 text-text-muted">Source</th><th className="type-label-md px-3 py-2 text-text-muted">Relationship</th><th className="type-label-md px-3 py-2 text-text-muted">Target</th><th className="type-label-md px-3 py-2 text-text-muted">Status</th></tr></thead>
        <tbody>{edges.length ? edges.map(edge => <tr key={edge.id} className="border-b border-border-faint last:border-0"><td className="type-body-sm px-3 py-2 text-ink">{nodes.find(node => node.id === edge.source)?.label ?? edge.source}</td><td className="type-body-sm px-3 py-2 text-text-secondary">{humanRelationshipLabel(edge.relationshipType)}</td><td className="type-body-sm px-3 py-2 text-ink">{nodes.find(node => node.id === edge.target)?.label ?? edge.target}</td><td className="type-label-sm px-3 py-2 text-text-muted">{edge.status}</td></tr>) : <tr><td colSpan={4} className="type-body-sm px-3 py-3 text-text-muted">No dependency relationships.</td></tr>}</tbody>
      </table>
    </div>
    </>
  );
}
