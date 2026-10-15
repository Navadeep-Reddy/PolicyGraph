import { IsOptional, IsString } from 'class-validator';

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

export function relationshipLabel(relationshipType: string): string {
  return ({ GOVERNS: 'governs', UPDATES: 'updates', APPEARS_IN: 'appears in' } as Record<string, string>)[relationshipType] ?? relationshipType;
}

export interface PolicyGraphNodeDto {
  id: string;
  type: 'CLAUSE' | 'ARTIFACT';
  label: string;
  subtitle: string | null;
}

export interface PolicyGraphEdgeDto {
  id: string;
  source: string;
  target: string;
  relationshipType: string;
  status: string;
}

export interface PolicyGraphDto {
  nodes: PolicyGraphNodeDto[];
  edges: PolicyGraphEdgeDto[];
}

export class GraphQueryDto {
  @IsOptional()
  @IsString()
  versionId?: string;
}
