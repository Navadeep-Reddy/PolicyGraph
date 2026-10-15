import { humanRelationshipLabel } from "../api/client.ts";
import type { GraphEdgeDto, GraphNodeDto } from "../types/index.ts";

interface PathViewerProps {
  nodes: GraphNodeDto[];
  edges: GraphEdgeDto[];
  distance: number;
}

/**
 * Textual equivalent of the selected dependency path. This is the
 * accessibility counterpart to the graph: every relationship shown
 * visually is also readable here.
 */
export default function PathViewer({ nodes, edges, distance }: PathViewerProps) {
  if (nodes.length === 0) return null;
  const edgeByTarget = new Map(edges.map((edge) => [edge.targetNodeId, edge]));
  return (
    <div aria-label="Dependency path explanation">
      <p className="type-label-sm text-text-muted">
        {distance === 1 ? "1 hop" : `${distance} hops`} · Approved dependencies
      </p>
      <ol className="mt-2">
        {nodes.map((node, index) => {
          const incoming = index === 0 ? null : (edgeByTarget.get(node.id) ?? null);
          return (
            <li key={node.id}>
              {incoming && (
                <p className="type-body-sm flex items-center gap-2 py-1 text-text-muted" aria-hidden="true">
                  <span className="ml-2 inline-block h-4 w-px bg-surface-4" />
                  <span>
                    ↓ {humanRelationshipLabel(incoming.relationshipType, incoming.relationshipLabel)}
                  </span>
                </p>
              )}
              <p className="type-body-sm rounded-inner border border-border-default bg-surface-white px-3 py-2">
                {node.nodeType === "CLAUSE" ? (
                  <span className="type-micro-mono text-accent">
                    {node.name}
                    <span className="sr-only"> (policy clause)</span>
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-ink">{node.name}</span>
                )}
                {/* Screen-reader text carries the relationship meaning. */}
                {incoming && (
                  <span className="sr-only">
                    {" "}
                    ({humanRelationshipLabel(incoming.relationshipType, incoming.relationshipLabel)}{" "}
                    from previous step)
                  </span>
                )}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
