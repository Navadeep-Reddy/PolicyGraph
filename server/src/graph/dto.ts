// Shared dependency-graph DTOs. Clause nodes are named by stableKey (e.g.
// TRAVEL-CLAIM-DEADLINE) and artifact nodes by artifact name; every edge
// carries both the raw relationshipType and a human-readable
// relationshipLabel so the client can render labels without mapping logic.

export interface GraphNodeDto {
  id: string;
  nodeType: 'CLAUSE' | 'ARTIFACT';
  name: string;
  artifactType?: 'FORM' | 'PROCEDURE' | 'CHECKLIST' | 'TRAINING_MATERIAL' | 'DEPARTMENT_INSTRUCTION' | 'INFORMATION_SHEET';
  description?: string | null;
}

export interface GraphEdgeDto {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationshipType: string;
  relationshipLabel: string;
  status: string;
  rationale?: string | null;
}

export interface PolicyGraphDto {
  policyId: string;
  nodes: GraphNodeDto[];
  edges: GraphEdgeDto[];
}

export const RELATIONSHIP_LABELS: Record<string, string> = {
  GOVERNS: 'governs',
  UPDATES: 'updates',
  APPEARS_IN: 'appears in',
};

export function relationshipLabel(relationshipType: string): string {
  return RELATIONSHIP_LABELS[relationshipType] ?? relationshipType;
}
