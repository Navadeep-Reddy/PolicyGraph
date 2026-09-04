// Pure BFS impact traversal for the PolicyGraph one-day MVP.
//
// Implements MVP_SPEC.md section 7 as backend domain logic with no NestJS,
// HTTP, or Prisma dependencies:
// - outgoing traversal only (edges are followed source -> target)
// - only eligible edges (APPROVED status plus optional validity window)
// - cycle-safe via a visited set
// - first visit wins, which yields the shortest unweighted path under BFS
// - one result per artifact, holding a single complete ordered path

export interface TraversalEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  status: string;
  validFrom: Date | string | null;
  validTo: Date | string | null;
}

export interface ImpactPath {
  artifactId: string;
  distance: number;
  pathNodeIds: string[];
  pathEdgeIds: string[];
}

// An edge participates in official impact analysis only when it is APPROVED
// and, when validity dates exist, valid at the run time.
export function isEdgeEligible(edge: TraversalEdge, runAt: Date): boolean {
  if (edge.status !== 'APPROVED') {
    return false;
  }
  if (edge.validFrom !== null && runAt < new Date(edge.validFrom)) {
    return false;
  }
  if (edge.validTo !== null && runAt > new Date(edge.validTo)) {
    return false;
  }
  return true;
}

// Multi-source BFS starting from the changed (ACTIVE predecessor) clause
// node ids. Artifact nodes may also be intermediate sources (e.g. a form
// consumed by a software rule), so every unvisited target is enqueued while
// only artifact targets produce results.
export function runImpactBfs(
  startNodeIds: readonly string[],
  edges: readonly TraversalEdge[],
  artifactIds: ReadonlySet<string>,
  runAt: Date,
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
      if (!isEdgeEligible(edge, runAt)) {
        continue;
      }
      const nextNodeId = edge.targetNodeId;
      if (visited.has(nextNodeId)) {
        continue;
      }
      visited.add(nextNodeId);
      const pathNodeIds = [...current.pathNodeIds, nextNodeId];
      const pathEdgeIds = [...current.pathEdgeIds, edge.id];
      if (artifactIds.has(nextNodeId) && !results.has(nextNodeId)) {
        results.set(nextNodeId, {
          artifactId: nextNodeId,
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
