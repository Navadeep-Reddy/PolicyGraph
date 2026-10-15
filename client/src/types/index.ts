export type VersionStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type ArtifactType = "FORM" | "PROCEDURE" | "CHECKLIST" | "TRAINING_MATERIAL"
  | "DEPARTMENT_INSTRUCTION" | "INFORMATION_SHEET";
export type RelationshipType = "GOVERNS" | "UPDATES" | "APPEARS_IN";
export type DependencyStatus = "PROPOSED" | "APPROVED" | "REJECTED";
export type DependencyOrigin = "AI" | "MANUAL";
export type ChangeType = "ADDED" | "REMOVED" | "MODIFIED" | "UNCHANGED";
export type ReviewStatus = "PROPOSED" | "CONFIRMED" | "DISMISSED" | "RESOLVED";
export type ApiErrorCode = "VALIDATION_ERROR" | "NOT_FOUND" | "CONFLICT" | "NO_BASE_VERSION" | "AI_FAILED";

export interface ApiErrorResponse {
  error: { code: ApiErrorCode; message: string };
}

export interface PolicySummary {
  id: string;
  title: string;
  description: string | null;
  activeVersionNumber: number | null;
  draftVersionId: string | null;
  activeVersionId: string | null;
  approvedDependencyCount: number;
  latestImpactRunId: string | null;
  updatedAt: string;
}

export interface Version {
  id: string;
  policyId: string;
  versionNumber: number;
  status: VersionStatus;
  publishedAt: string | null;
  createdAt: string;
}

export interface Clause {
  id: string;
  versionId: string;
  stableKey: string;
  title: string;
  text: string;
  category: string;
  position: number;
}

export interface PolicyDetail {
  id: string;
  title: string;
  description: string | null;
  versions: Version[];
}

export interface VersionDetail extends Version {
  clauses: Clause[];
}

export interface Item {
  id: string;
  name: string;
  type: ArtifactType;
  department: string;
  description: string | null;
  content: string | null;
}

export interface Dependency {
  id: string;
  policyId: string;
  sourceType: "CLAUSE" | "ARTIFACT";
  sourceClauseKey: string | null;
  sourceArtifactId: string | null;
  sourceLabel: string;
  targetArtifactId: string;
  targetLabel: string;
  relationshipType: RelationshipType;
  status: DependencyStatus;
  origin: DependencyOrigin;
  rationale: string | null;
}

export interface GraphNode {
  id: string;
  type: "CLAUSE" | "ARTIFACT";
  label: string;
  subtitle: string | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationshipType: RelationshipType;
  status: DependencyStatus;
}

export interface PolicyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ClauseChange {
  stableKey: string;
  changeType: ChangeType;
  before: Clause | null;
  after: Clause | null;
}

export interface PathNode { id: string; type: "CLAUSE" | "ARTIFACT"; label: string }
export interface PathEdge { id: string; relationshipType: RelationshipType }

export interface ImpactResult {
  id: string;
  changedClauseKey: string;
  artifact: { id: string; name: string; type: ArtifactType; department: string };
  distance: number;
  reason: string;
  path: { nodes: PathNode[]; edges: PathEdge[] };
  reviewStatus: ReviewStatus;
  reviewComment: string | null;
}

export interface ImpactReport {
  id: string;
  policyId: string;
  policyTitle: string;
  versionId: string;
  baseVersionId: string;
  createdAt: string;
  changedClauses: { stableKey: string; changeType: ChangeType; oldText: string | null; newText: string | null }[];
  affectedDepartments: string[];
  results: ImpactResult[];
}

export interface ImpactRunSummary { id: string; createdAt: string; resultCount: number }
export interface CreatePolicyInput { title: string; description?: string; text: string }
export interface CreatePolicyResponse { policy: PolicyDetail; draft: VersionDetail }
export interface CreateClauseInput { stableKey: string; title: string; text: string; category: string }
export type UpdateClauseInput = Partial<Pick<Clause, "title" | "text" | "category">>;
export interface CreateItemInput {
  name: string;
  type: ArtifactType;
  department: string;
  description?: string;
  content?: string;
}
export interface CreateDependencyInput {
  sourceType: "CLAUSE" | "ARTIFACT";
  sourceClauseKey?: string;
  sourceArtifactId?: string;
  targetArtifactId: string;
  relationshipType: RelationshipType;
  rationale?: string;
}
export type UpdateDependencyInput = Partial<Pick<Dependency, "status" | "relationshipType">> & { rationale?: string };
export interface DependencySuggestions { created: Dependency[]; skipped: number }
