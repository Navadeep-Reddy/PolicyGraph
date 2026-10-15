import type {
  ApiErrorCode, ClauseChange, Dependency, ImpactReport, Item,
  PolicyDetail, PolicySummary, VersionDetail,
} from "../types/index.ts";

// Optional snapshots let development checks exercise response states. The app
// itself starts empty; this transport never extracts clauses or calculates impact.
interface MockSnapshots {
  policies?: PolicySummary[];
  details?: PolicyDetail[];
  versions?: VersionDetail[];
  items?: Item[];
  dependencies?: Dependency[];
  reports?: ImpactReport[];
  comparisons?: Record<string, ClauseChange[]>;
}

const response = (body: unknown, status = 200) => Response.json(body, { status });
const failure = (code: ApiErrorCode, message: string, status: number) => response({ error: { code, message } }, status);
const missing = () => failure("NOT_FOUND", "Resource not found", 404);

export function createMockRequest(snapshots: MockSnapshots = {}) {
  const data = structuredClone(snapshots);
  const policies = data.policies ?? [];
  const details = data.details ?? [];
  const versions = data.versions ?? [];
  const items = data.items ?? [];
  const dependencies = data.dependencies ?? [];
  const reports = data.reports ?? [];

  return async (path: string, init: RequestInit = {}): Promise<Response> => {
    if (!import.meta.env.DEV) throw new Error("Development mocks are unavailable in production.");
    const url = new URL(path, "http://mock.local");
    const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const [resource, resourceId, action, childId] = segments;
    const method = init.method ?? "GET";
    const body: unknown = typeof init.body === "string" ? JSON.parse(init.body) : {};
    const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};

    if (method === "GET" && path === "/health") return response({ status: "ok" });
    if (resource === "items" && segments.length <= 2) {
      if (!resourceId && method === "GET") return response(items);
      const index = items.findIndex(item => item.id === resourceId);
      if (resourceId && index < 0) return missing();
      if (method === "DELETE" && resourceId) {
        items.splice(index, 1);
        for (let i = dependencies.length - 1; i >= 0; i--) {
          if (dependencies[i].sourceArtifactId === resourceId || dependencies[i].targetArtifactId === resourceId) dependencies.splice(i, 1);
        }
        return new Response(null, { status: 204 });
      }
      if ((!resourceId && method === "POST") || (resourceId && method === "PATCH")) {
        const previous = resourceId ? items[index] : null;
        const item = { ...previous, ...input };
        const types = ["FORM", "PROCEDURE", "CHECKLIST", "TRAINING_MATERIAL", "DEPARTMENT_INSTRUCTION", "INFORMATION_SHEET"];
        if (typeof item.name !== "string" || !item.name.trim() || typeof item.department !== "string" || !item.department.trim() || typeof item.type !== "string" || !types.includes(item.type)
          || (item.description != null && typeof item.description !== "string") || (item.content != null && typeof item.content !== "string")) {
          return failure("VALIDATION_ERROR", "Provide a name, supported item type, and department.", 400);
        }
        const saved: Item = {
          id: previous?.id ?? crypto.randomUUID(), name: item.name, type: item.type as Item["type"],
          department: item.department, description: typeof item.description === "string" ? item.description : null,
          content: typeof item.content === "string" ? item.content : null,
        };
        if (previous) items[index] = saved;
        else items.push(saved);
        return response(saved, previous ? 200 : 201);
      }
    }

    if (resource === "policies") {
      if (!resourceId && method === "GET") return response(policies);
      if (!resourceId && method === "POST") {
        if (typeof input.title !== "string" || !input.title.trim() || typeof input.text !== "string" || !input.text.trim()) return failure("VALIDATION_ERROR", "Provide a policy title and text.", 400);
        return failure("AI_FAILED", "Clause extraction requires the real API. Development mocks do not generate AI output.", 502);
      }
      const detail = details.find(policy => policy.id === resourceId);
      if (!detail) return missing();
      if (!action && method === "GET") return response(detail);
      if (action === "dependencies" && method === "GET") return response(dependencies.filter(edge => edge.policyId === resourceId && (!url.searchParams.has("status") || edge.status === url.searchParams.get("status"))));
      if (action === "graph" && method === "GET") {
        const versionId = url.searchParams.get("versionId");
        const version = versions.find(version => version.policyId === resourceId && (versionId ? version.id === versionId : version.status === "DRAFT"))
          ?? (versionId ? undefined : versions.find(version => version.policyId === resourceId && version.status === "ACTIVE"));
        if (!version) return missing();
        const keys = new Set(version.clauses.map(clause => clause.stableKey));
        return response({
          nodes: [
            ...version.clauses.map(clause => ({ id: `clause:${clause.stableKey}`, type: "CLAUSE", label: clause.title, subtitle: null })),
            ...items.map(item => ({ id: `artifact:${item.id}`, type: "ARTIFACT", label: item.name, subtitle: `${item.type} · ${item.department}` })),
          ],
          edges: dependencies.filter(edge => edge.policyId === resourceId && edge.status !== "REJECTED" && (edge.sourceType !== "CLAUSE" || keys.has(edge.sourceClauseKey ?? ""))).map(edge => ({
            id: edge.id, source: edge.sourceType === "CLAUSE" ? `clause:${edge.sourceClauseKey}` : `artifact:${edge.sourceArtifactId}`,
            target: `artifact:${edge.targetArtifactId}`, relationshipType: edge.relationshipType, status: edge.status,
          })),
        });
      }
      if (action === "dependency-suggestions" && method === "POST") return failure("AI_FAILED", "Dependency suggestion requires the real API. Development mocks do not generate AI output.", 502);
      if (action === "revisions" && method === "POST") return failure("CONFLICT", "Revision creation requires the real API in this development transport.", 409);
    }

    if (resource === "versions") {
      const version = versions.find(version => version.id === resourceId);
      if (!version) return missing();
      if (!action && method === "GET") return response(version);
      if (action === "changes" && method === "GET") {
        const against = url.searchParams.get("against") ?? versions.find(other => other.policyId === version.policyId && other.versionNumber === version.versionNumber - 1)?.id;
        if (!against) return failure("NO_BASE_VERSION", "No earlier version to compare against.", 409);
        const snapshot = data.comparisons?.[`${version.id}:${against}`];
        return snapshot ? response(snapshot) : failure("CONFLICT", "No comparison snapshot supplied. Change detection requires the real API.", 409);
      }
      if (action === "impact-runs" && method === "GET") return response(reports.filter(report => report.versionId === resourceId).map(report => ({ id: report.id, createdAt: report.createdAt, resultCount: report.results.length })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      if (action === "impact-runs" && method === "POST") return failure("CONFLICT", "Impact calculation requires the real API. Development mocks never calculate impact.", 409);
      if (action === "clauses" && childId && method === "PATCH") {
        if (version.status !== "DRAFT") return failure("CONFLICT", "Only draft clauses are editable.", 409);
        const clause = version.clauses.find(clause => clause.id === childId);
        if (!clause) return missing();
        for (const key of ["title", "text", "category"] as const) {
          if (input[key] !== undefined) {
            if (typeof input[key] !== "string" || !input[key].trim()) return failure("VALIDATION_ERROR", "Clause fields cannot be empty.", 400);
          }
        }
        for (const key of ["title", "text", "category"] as const) if (typeof input[key] === "string") clause[key] = input[key];
        return response(clause);
      }
    }

    if (resource === "impact-runs" && method === "GET") {
      const report = reports.find(report => report.id === resourceId);
      return report ? response(report) : missing();
    }
    if (resource === "impact-results" && method === "PATCH") {
      const result = reports.flatMap(report => report.results).find(result => result.id === resourceId);
      if (!result) return missing();
      if (!["PROPOSED", "CONFIRMED", "DISMISSED", "RESOLVED"].includes(String(input.reviewStatus)) || (input.reviewComment !== undefined && typeof input.reviewComment !== "string")) return failure("VALIDATION_ERROR", "Provide a valid review status and optional comment.", 400);
      result.reviewStatus = input.reviewStatus as typeof result.reviewStatus;
      if (typeof input.reviewComment === "string") result.reviewComment = input.reviewComment;
      return response(result);
    }
    return missing();
  };
}

export const mockRequest = createMockRequest();
