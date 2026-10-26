import { humanRelationshipLabel } from "../api/client.ts";
import type { CSSProperties } from "react";
import type { PathEdge, PathNode } from "../types/index.ts";

interface PathViewerProps {
  nodes: PathNode[];
  edges: PathEdge[];
  distance: number;
}

/**
 * Textual equivalent of the selected dependency path. This is the
 * accessibility counterpart to the graph: every relationship shown
 * visually is also readable here.
 */
export default function PathViewer({ nodes, edges, distance }: PathViewerProps) {
  if (nodes.length === 0) return null;
  const relationshipColor = (edge: PathEdge) => edge.relationshipType === "GOVERNS"
    ? "var(--route-scarlet)"
    : edge.relationshipType === "UPDATES"
      ? "var(--route-cobalt)"
      : "var(--route-amber)";
  return (
    <div aria-label="Dependency path explanation">
      <p className="type-label-sm text-text-muted">
        {distance === 1 ? "1 hop" : `${distance} hops`} · Approved dependencies
      </p>
      <ol className="mt-2">
        {nodes.map((node, index) => {
          const incoming = index === 0 ? null : (edges[index - 1] ?? null);
          return (
            <li key={node.id}>
              {incoming && (
                <p className="type-body-sm flex items-center gap-2 py-1 text-text-muted" aria-hidden="true">
                  <span className="ml-2 inline-block h-4 w-[3px]" style={{ backgroundColor: relationshipColor(incoming) }} />
                  <span className="flex items-center gap-2">
                    <span className="route-node inline-block h-2.5 w-2.5" style={{ "--route-color": relationshipColor(incoming) } as CSSProperties} />
                    {humanRelationshipLabel(incoming.relationshipType)}
                  </span>
                </p>
              )}
              <p className="type-body-sm flex items-center gap-2 rounded-inner border border-border-default bg-surface-white px-3 py-2">
                <span className="route-node inline-block h-3 w-3 shrink-0" style={{ "--route-color": node.type === "CLAUSE" ? "var(--route-amber)" : "var(--route-cobalt)" } as CSSProperties} aria-hidden="true" />
                {node.type === "CLAUSE" ? (
                  <span className="type-micro-mono text-accent">
                    {node.label}
                    <span className="sr-only"> (policy clause)</span>
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-ink">{node.label}</span>
                )}
                {/* Screen-reader text carries the relationship meaning. */}
                {incoming && (
                  <span className="sr-only">
                    {" "}
                    ({humanRelationshipLabel(incoming.relationshipType)}{" "}
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
