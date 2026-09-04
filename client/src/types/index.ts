export type VersionStatus = "ACTIVE" | "DRAFT";
export type ChangeType = "ADDED" | "REMOVED" | "MODIFIED" | "UNCHANGED";
export type ArtifactType = "FORM" | "PROCEDURE" | "SOFTWARE_RULE";
export type ReviewStatus = "PROPOSED" | "CONFIRMED" | "DISMISSED" | "RESOLVED";

export interface ClauseDto {
  id: string;
  policyVersionId: string;
  stableKey: string;
  text: string;
  position: number;
  textHash: string;
}

export interface VersionSummaryDto {
  id: string;
  policyId: string;
  versionNumber: number;
  status: VersionStatus;
  effectiveDate: string | null;
  createdAt: string;
  clauseCount: number;
}

export interface VersionWithClausesDto {
  id: string;
  policyId: string;
  versionNumber: number;
  status: VersionStatus;
  effectiveDate: string | null;
  createdAt: string;
  clauses: ClauseDto[];
}

export interface PolicyListItemDto {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  activeVersion: VersionSummaryDto | null;
  draftVersion: VersionSummaryDto | null;
  approvedDependencyCount: number;
  latestImpactRun: {
    id: string;
    policyVersionId: string;
    createdAt: string;
    resultCount: number;
  } | null;
}

export interface PolicyDetailDto {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  activeVersion: VersionWithClausesDto | null;
  draftVersion: VersionWithClausesDto | null;
}

export interface ClauseChangeDto {
  stableKey: string;
  changeType: ChangeType;
  activeClause: ClauseDto | null;
  draftClause: ClauseDto | null;
}

export interface VersionChangesDto {
  versionId: string;
  policyId: string;
  changes: ClauseChangeDto[];
}

export interface GraphNodeDto {
  id: string;
  nodeType: "CLAUSE" | "ARTIFACT";
  name: string;
  artifactType?: ArtifactType;
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

export interface ImpactResultArtifactDto {
  id: string;
  name: string;
  type: ArtifactType;
  description: string | null;
  criticality: number;
}

export interface ImpactResultDto {
  id: string;
  artifact: ImpactResultArtifactDto;
  distance: number;
  reason: string;
  reviewStatus: ReviewStatus;
  reviewComment: string | null;
  path: {
    nodes: GraphNodeDto[];
    edges: GraphEdgeDto[];
  };
}

export interface ImpactReportDto {
  id: string;
  policyVersionId: string;
  policyId: string;
  createdAt: string;
  changeSummary: ClauseChangeDto[];
  graph: PolicyGraphDto;
  results: ImpactResultDto[];
}
