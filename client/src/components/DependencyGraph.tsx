import { useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
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
  subtitle: string | null;
  clickable: boolean;
  onClick: () => void;
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
      onClick={data.clickable ? data.onClick : undefined}
      role={data.clickable ? "button" : undefined}
      tabIndex={data.clickable ? 0 : undefined}
      aria-label={data.clickable ? `Focus dependencies for ${data.name}` : undefined}
      onKeyDown={data.clickable ? event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          data.onClick();
        }
      } : undefined}
      className={`w-[260px] rounded-card border px-4 py-3 shadow-sm ${data.clickable ? "cursor-pointer" : ""} ${surface} ${
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
            className={`block whitespace-normal break-words leading-5 ${
              data.mono ? "type-micro-mono text-accent" : "text-sm font-semibold text-ink"
            }`}
            title={data.name}
          >
            {data.name}
          </span>
        </span>
      </div>
      {data.subtitle && <span className="mt-2 block pl-9 text-xs leading-4 text-text-muted">{data.subtitle}</span>}
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
  interactiveClauseFocus?: boolean;
  hideOrphanClauses?: boolean;
}

function glyphFor(node: GraphNodeType): string {
  return node.type === "CLAUSE" ? "§" : "▤";
}

function kindLabelFor(node: GraphNodeType): string {
  return node.type === "CLAUSE" ? "Policy clause" : "Operational item";
}

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
  interactiveClauseFocus = false,
  hideOrphanClauses = false,
}: DependencyGraphProps) {
  const [focusedClause, setFocusedClause] = useState<string | null>(null);
  const [includeProposed, setIncludeProposed] = useState(true);
  const [showOrphans, setShowOrphans] = useState(!hideOrphanClauses);
  const display = useMemo(() => {
    const shownEdges = edges.filter(edge => edge.status === "APPROVED" || (includeProposed && edge.status === "PROPOSED"));
    const connected = new Set(shownEdges.flatMap(edge => [edge.source, edge.target]));
    let shownNodes = nodes.filter(node => showOrphans || connected.has(node.id) || node.id === focusedClause || !hideOrphanClauses);
    if (interactiveClauseFocus && focusedClause) {
      const reachable = new Set([focusedClause]);
      const outgoing = new Map<string, string[]>();
      shownEdges.forEach(edge => outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]));
      const queue = [focusedClause];
      for (let index = 0; index < queue.length; index++) {
        const current = queue[index];
        if (current === undefined) continue;
        for (const target of outgoing.get(current) ?? []) {
          if (!reachable.has(target)) {
            reachable.add(target);
            queue.push(target);
          }
        }
      }
      shownNodes = shownNodes.filter(node => reachable.has(node.id));
    }
    const ids = new Set(shownNodes.map(node => node.id));
    return { nodes: shownNodes, edges: shownEdges.filter(edge => ids.has(edge.source) && ids.has(edge.target)) };
  }, [nodes, edges, includeProposed, showOrphans, interactiveClauseFocus, focusedClause, hideOrphanClauses]);
  const { flowNodes, flowEdges } = useMemo(() => {
    const hasSelection = selectedNodeIds.length > 0 || selectedEdgeIds.length > 0;
    const selectedNodes = new Set(selectedNodeIds);
    const selectedEdges = new Set(selectedEdgeIds);
    const columns = layoutColumns(display.nodes, display.edges);
    const byColumn = new Map<number, GraphNodeType[]>();
    for (const node of display.nodes) {
      const col = columns.get(node.id) ?? 0;
      const list = byColumn.get(col) ?? [];
      list.push(node);
      byColumn.set(col, list);
    }

    const flowNodes: Node<GraphNodeData>[] = [];
    const maxColumn = Math.max(0, ...byColumn.keys());
    const xGap = Math.max(360, Math.min(520, 1600 / Math.max(1, maxColumn)));
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
            position: { x: 36 + col * xGap, y: 32 + row * 170 },
            data: {
              kindLabel: kindLabelFor(node),
              name: node.label,
              mono: false,
              subtitle: node.subtitle,
              clickable: interactiveClauseFocus && node.type === "CLAUSE",
              onClick: () => setFocusedClause(node.id),
              glyph: glyphFor(node),
              visual,
              dimmed,
            },
            selectable: false,
            draggable: true,
          });
        });
    }

    const flowEdges: Edge[] = display.edges.map((edge) => {
      const approved = edge.status === "APPROVED";
      const onPath = selectedEdges.has(edge.id);
      return {
        id: edge.id,
        type: "smoothstep",
        source: edge.source,
        target: edge.target,
        label: humanRelationshipLabel(edge.relationshipType).toUpperCase(),
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#36637C", width: 18, height: 18 },
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
  }, [display, selectedNodeIds, selectedEdgeIds, affectedNodeId, interactiveClauseFocus]);

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
    {interactiveClauseFocus && <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="type-body-sm text-text-secondary" aria-live="polite">{focusedClause ? `Focused on ${nodes.find(node => node.id === focusedClause)?.label ?? focusedClause}` : "Select a clause to focus its downstream dependencies."}{focusedClause && display.edges.length === 0 && " · No dependencies for this clause."}</div>
      {focusedClause && <button type="button" onClick={() => setFocusedClause(null)} className="type-label-md h-9 rounded-action border border-border-default bg-glass-80 px-4 text-ink">Show all</button>}
      <label className="type-body-sm flex items-center gap-2 text-text-secondary"><input type="checkbox" checked={includeProposed} onChange={event => setIncludeProposed(event.target.checked)} /> Include proposed</label>
      {hideOrphanClauses && <label className="type-body-sm flex items-center gap-2 text-text-secondary"><input type="checkbox" checked={showOrphans} onChange={event => setShowOrphans(event.target.checked)} /> Show clauses without dependencies</label>}
    </div>}
    <div
      className={`graph-canvas ${heightClassName} overflow-hidden rounded-card border border-border-default`}
      role="img"
      aria-label={`Dependency graph with ${display.nodes.length} nodes and ${display.edges.length} relationships. A text equivalent is listed below the graph.`}
    >
      {display.nodes.length === 0 ? <div className="flex h-full items-center justify-center p-4"><p className="type-body-md text-text-muted">No connected dependencies. Enable “Show clauses without dependencies” to view all clauses.</p></div> : <ReactFlow
        key={display.nodes.map(node => node.id).join("|")}
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: false }}
        minZoom={0.25}
        maxZoom={1.5}
      >
        <Background color="rgba(54,99,124,0.08)" gap={24} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>}
    </div>
    <div className="mt-3 overflow-x-auto rounded-card border border-border-default bg-glass-90">
      <table className="w-full min-w-[520px] border-collapse text-left">
        <caption className="sr-only">Text equivalent of dependency graph relationships</caption>
        <thead><tr className="border-b border-border-strong"><th className="type-label-md px-3 py-2 text-text-muted">Source</th><th className="type-label-md px-3 py-2 text-text-muted">Relationship</th><th className="type-label-md px-3 py-2 text-text-muted">Target</th><th className="type-label-md px-3 py-2 text-text-muted">Status</th></tr></thead>
        <tbody>{display.edges.map(edge => <tr key={edge.id} className="border-b border-border-faint last:border-0"><td className="type-body-sm px-3 py-2 text-ink">{display.nodes.find(node => node.id === edge.source)?.label ?? edge.source}</td><td className="type-body-sm px-3 py-2 text-text-secondary">{humanRelationshipLabel(edge.relationshipType)}</td><td className="type-body-sm px-3 py-2 text-ink">{display.nodes.find(node => node.id === edge.target)?.label ?? edge.target}</td><td className="type-label-sm px-3 py-2 text-text-muted">{edge.status}</td></tr>)}{display.nodes.filter(node => node.type === "CLAUSE" && !display.edges.some(edge => edge.source === node.id || edge.target === node.id)).map(node => <tr key={`isolated-${node.id}`}><td className="type-body-sm px-3 py-2 text-ink">{node.label}</td><td colSpan={2} className="type-body-sm px-3 py-2 text-text-muted">No dependencies for this clause.</td><td className="type-label-sm px-3 py-2 text-text-muted">—</td></tr>)}{display.edges.length === 0 && display.nodes.every(node => node.type !== "CLAUSE" || display.edges.some(edge => edge.source === node.id || edge.target === node.id)) && <tr><td colSpan={4} className="type-body-sm px-3 py-3 text-text-muted">No dependency relationships.</td></tr>}</tbody>
      </table>
    </div>
    <p className="type-body-sm mt-2 text-text-muted">Legend: solid arrow = approved · dashed arrow = proposed · labels show relationship type.</p>
    {hideOrphanClauses && <div className="sr-only">{nodes.filter(node => node.type === "CLAUSE" && !display.nodes.some(shown => shown.id === node.id)).map(node => node.label).join(", ")}</div>}
    </>
  );
}
