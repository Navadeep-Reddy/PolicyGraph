import type { GraphEdgeDto, GraphNodeDto } from '../graph/dto.js';

export interface ResolvedImpactPath {
  nodes: readonly GraphNodeDto[];
  edges: readonly GraphEdgeDto[];
}

export class InvalidImpactPathError extends Error {
  constructor() {
    super('Cannot generate a reason from an invalid impact path');
    this.name = 'InvalidImpactPathError';
  }
}

const RELATIONSHIPS = ['GOVERNS', 'UPDATES', 'APPEARS_IN'] as const;
type Relationship = (typeof RELATIONSHIPS)[number];

export function buildImpactReason(
  changeType: 'MODIFIED' | 'REMOVED',
  changedClauseKey: string,
  affectedItemName: string,
  path: ResolvedImpactPath,
): string {
  if (!changedClauseKey.trim() || !affectedItemName.trim() || path.nodes.length < 2 || path.edges.length !== path.nodes.length - 1) {
    throw new InvalidImpactPathError();
  }
  const start = path.nodes[0];
  const end = path.nodes[path.nodes.length - 1];
  if (!start || start.nodeType !== 'CLAUSE' || start.id !== `clause:${changedClauseKey}` || start.name !== changedClauseKey || !end || end.nodeType !== 'ARTIFACT' || end.name !== affectedItemName) {
    throw new InvalidImpactPathError();
  }

  const hops = path.edges.map((edge, index) => {
    const source = path.nodes[index];
    const target = path.nodes[index + 1];
    if (!source || !target || edge.sourceNodeId !== source.id || edge.targetNodeId !== target.id || !(RELATIONSHIPS as readonly string[]).includes(edge.relationshipType)) {
      throw new InvalidImpactPathError();
    }
    const relationship = edge.relationshipType as Relationship;
    return `"${source.name}" --${relationship}--> "${target.name}"`;
  });
  return `${changeType} clause "${changedClauseKey}" affects operational item "${affectedItemName}" via ${hops.join('; then ')}.`;
}
