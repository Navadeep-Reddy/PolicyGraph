import type {
  ClauseDto,
  ImpactReportDto,
  ImpactResultDto,
  PolicyDetailDto,
  PolicyGraphDto,
  PolicyListItemDto,
  ReviewStatus,
  VersionChangesDto,
} from "../types/index.ts";

const API_BASE = import.meta.env.VITE_API_URL as string | undefined;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE ?? ""}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (typeof body.message === "string") detail = body.message;
      else if (Array.isArray(body.message)) detail = body.message.join(", ");
    } catch {
      // Keep the default detail when the error body is not JSON.
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}

export function listPolicies(): Promise<PolicyListItemDto[]> {
  return request<PolicyListItemDto[]>("/policies");
}

export function getPolicy(policyId: string): Promise<PolicyDetailDto> {
  return request<PolicyDetailDto>(`/policies/${policyId}`);
}

export function getPolicyGraph(policyId: string): Promise<PolicyGraphDto> {
  return request<PolicyGraphDto>(`/policies/${policyId}/graph`);
}

export function getVersionChanges(versionId: string): Promise<VersionChangesDto> {
  return request<VersionChangesDto>(`/versions/${versionId}/changes`);
}

export function updateClause(
  versionId: string,
  clauseId: string,
  text: string,
): Promise<ClauseDto> {
  return request<ClauseDto>(`/versions/${versionId}/clauses/${clauseId}`, {
    method: "PATCH",
    body: JSON.stringify({ text }),
  });
}

export function createImpactRun(versionId: string): Promise<ImpactReportDto> {
  return request<ImpactReportDto>(`/versions/${versionId}/impact-runs`, {
    method: "POST",
  });
}

export function getImpactRun(impactRunId: string): Promise<ImpactReportDto> {
  return request<ImpactReportDto>(`/impact-runs/${impactRunId}`);
}

export function updateImpactResult(
  impactResultId: string,
  reviewStatus: ReviewStatus,
  reviewComment?: string,
): Promise<ImpactResultDto> {
  return request<ImpactResultDto>(`/impact-results/${impactResultId}`, {
    method: "PATCH",
    body: JSON.stringify(
      reviewComment === undefined ? { reviewStatus } : { reviewStatus, reviewComment },
    ),
  });
}

/** Human-facing edge labels per DESIGN.md; falls back to the server label. */
export function humanRelationshipLabel(relationshipType: string, fallback: string): string {
  switch (relationshipType) {
    case "IMPLEMENTED_BY":
      return "Implements";
    case "REFERENCED_BY":
      return "References";
    case "CONSUMED_BY":
      return "Feeds into";
    default:
      return fallback
        .split(/[_ ]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
  }
}

export function humanArtifactType(type: string): string {
  switch (type) {
    case "FORM":
      return "Form";
    case "PROCEDURE":
      return "Procedure";
    case "SOFTWARE_RULE":
      return "Software rule";
    default:
      return type;
  }
}
