export type TraversalChangeType = 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';

export interface TraversalChange {
  stableKey: string;
  changeType: TraversalChangeType;
}

export interface TraversalEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  status: string;
}

export interface ImpactPath {
  changedClauseKey: string;
  artifactId: string;
  distance: number;
  pathNodeIds: string[];
  pathEdgeIds: string[];
}

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

export function isEdgeEligible(edge: TraversalEdge): boolean {
  return edge.status === 'APPROVED';
}

/** Deterministic per-changed-clause BFS over canonical clause:/artifact: node ids. */
export function runImpactBfs(
  changes: readonly TraversalChange[],
  edges: readonly TraversalEdge[],
  artifactIds: ReadonlySet<string>,
): ImpactPath[] {
  const outgoingBySource = new Map<string, TraversalEdge[]>();
  for (const edge of edges) {
    if (!isEdgeEligible(edge)) continue;
    const outgoing = outgoingBySource.get(edge.sourceNodeId) ?? [];
    outgoing.push(edge);
    outgoingBySource.set(edge.sourceNodeId, outgoing);
  }
  for (const outgoing of outgoingBySource.values()) {
    outgoing.sort((a, b) => compare(a.targetNodeId, b.targetNodeId) || compare(a.id, b.id));
  }

  const eligibleChanges = changes
    .filter(({ changeType }) => changeType === 'MODIFIED' || changeType === 'REMOVED')
    .slice()
    .sort((a, b) => compare(a.stableKey, b.stableKey));
  const results: ImpactPath[] = [];

  for (const change of eligibleChanges) {
    const start = `clause:${change.stableKey}`;
    const visited = new Set<string>([start]);
    const queue: { nodeId: string; pathNodeIds: string[]; pathEdgeIds: string[] }[] = [
      { nodeId: start, pathNodeIds: [start], pathEdgeIds: [] },
    ];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      if (!current) continue;
      for (const edge of outgoingBySource.get(current.nodeId) ?? []) {
        const nextNodeId = edge.targetNodeId;
        if (visited.has(nextNodeId)) continue;
        visited.add(nextNodeId);
        const pathNodeIds = [...current.pathNodeIds, nextNodeId];
        const pathEdgeIds = [...current.pathEdgeIds, edge.id];
        if (nextNodeId.startsWith('artifact:')) {
          const artifactId = nextNodeId.slice('artifact:'.length);
          if (artifactIds.has(nextNodeId) || artifactIds.has(artifactId)) {
            results.push({ changedClauseKey: change.stableKey, artifactId, distance: pathEdgeIds.length, pathNodeIds, pathEdgeIds });
          }
        }
        queue.push({ nodeId: nextNodeId, pathNodeIds, pathEdgeIds });
      }
    }
  }
  return results.sort((a, b) => a.distance - b.distance || compare(a.changedClauseKey, b.changedClauseKey) || compare(a.artifactId, b.artifactId));
}
