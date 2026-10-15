// Pure BFS impact traversal for the PolicyGraph one-day MVP.
//
// Implements MVP_SPEC.md section 7 as backend domain logic with no NestJS,
// HTTP, or Prisma dependencies:
// - outgoing traversal only (edges are followed source -> target)
// - only APPROVED edges
// - cycle-safe via a visited set
// - first visit wins, which yields the shortest unweighted path under BFS
// - one result per artifact, holding a single complete ordered path

export interface TraversalEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  status: string;
}

export interface ImpactPath {
  artifactId: string;
  distance: number;
  pathNodeIds: string[];
  pathEdgeIds: string[];
}

// An edge participates in impact analysis only when it is APPROVED.
export function isEdgeEligible(edge: TraversalEdge): boolean {
  return edge.status === 'APPROVED';
}

// Multi-source BFS starting from the changed (ACTIVE predecessor) clause
// node ids. Artifact nodes may also be intermediate sources (e.g. a form
// consumed by a software rule), so every unvisited target is enqueued while
// only artifact targets produce results.
export function runImpactBfs(
  startNodeIds: readonly string[],
  edges: readonly TraversalEdge[],
  artifactIds: ReadonlySet<string>,
): ImpactPath[] {
  const outgoingBySource = new Map<string, TraversalEdge[]>();
  for (const edge of edges) {
    const outgoing = outgoingBySource.get(edge.sourceNodeId);
    if (outgoing) {
      outgoing.push(edge);
    } else {
      outgoingBySource.set(edge.sourceNodeId, [edge]);
    }
  }

  const visited = new Set<string>(startNodeIds);
  const queue: { nodeId: string; pathNodeIds: string[]; pathEdgeIds: string[] }[] =
    startNodeIds.map((nodeId) => ({ nodeId, pathNodeIds: [nodeId], pathEdgeIds: [] }));
  const results = new Map<string, ImpactPath>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }
    for (const edge of outgoingBySource.get(current.nodeId) ?? []) {
      if (!isEdgeEligible(edge)) {
        continue;
      }
      const nextNodeId = edge.targetNodeId;
      if (visited.has(nextNodeId)) {
        continue;
      }
      visited.add(nextNodeId);
      const pathNodeIds = [...current.pathNodeIds, nextNodeId];
      const pathEdgeIds = [...current.pathEdgeIds, edge.id];
      const artifactId = nextNodeId.startsWith('artifact:')
        ? nextNodeId.slice('artifact:'.length)
        : nextNodeId;
      if ((artifactIds.has(nextNodeId) || artifactIds.has(artifactId)) && !results.has(nextNodeId)) {
        results.set(nextNodeId, {
          artifactId,
          distance: pathEdgeIds.length,
          pathNodeIds,
          pathEdgeIds,
        });
      }
      queue.push({ nodeId: nextNodeId, pathNodeIds, pathEdgeIds });
    }
  }

  return [...results.values()];
}
