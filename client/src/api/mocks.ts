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
      if (!resourceId && method === "POST" && url.pathname === "/policies/import") return failure("AI_FAILED", "PDF clause extraction requires the real API. Development mocks do not generate AI output.", 502);
      if (!resourceId && method === "POST") {
        if (typeof input.title !== "string" || !input.title.trim() || typeof input.text !== "string" || !input.text.trim()) return failure("VALIDATION_ERROR", "Provide a policy title and text.", 400);
        return failure("AI_FAILED", "Clause extraction requires the real API. Development mocks do not generate AI output.", 502);
      }
      const detail = details.find(policy => policy.id === resourceId);
      if (!detail) return missing();
      if (!action && method === "GET") return response(detail);
      if (action === "dependencies" && method === "GET") return response(dependencies.filter(edge => edge.policyId === resourceId && (!url.searchParams.has("status") || edge.status === url.searchParams.get("status"))));
      if (action === "dependencies" && method === "POST") {
        const sourceType = input.sourceType;
        const target = items.find(item => item.id === input.targetArtifactId);
        const sourceItem = items.find(item => item.id === input.sourceArtifactId);
        const version = versions.find(row => row.policyId === resourceId && row.status === "DRAFT") ?? versions.find(row => row.policyId === resourceId && row.status === "ACTIVE");
        const sourceClause = version?.clauses.find(clause => clause.stableKey === input.sourceClauseKey);
        if ((sourceType !== "CLAUSE" && sourceType !== "ARTIFACT") || !target || (sourceType === "CLAUSE" ? !sourceClause : !sourceItem) || !["GOVERNS", "UPDATES", "APPEARS_IN"].includes(String(input.relationshipType))) return failure("VALIDATION_ERROR", "Provide valid dependency endpoints and relationship type.", 400);
        const duplicate = dependencies.some(edge => edge.policyId === resourceId && edge.sourceType === sourceType && edge.sourceClauseKey === (sourceType === "CLAUSE" ? input.sourceClauseKey : null) && edge.sourceArtifactId === (sourceType === "ARTIFACT" ? input.sourceArtifactId : null) && edge.targetArtifactId === target.id && edge.relationshipType === input.relationshipType);
        if (duplicate) return failure("CONFLICT", "This dependency already exists.", 409);
        const edge: Dependency = { id: crypto.randomUUID(), policyId: resourceId, sourceType, sourceClauseKey: sourceType === "CLAUSE" ? String(input.sourceClauseKey) : null, sourceArtifactId: sourceType === "ARTIFACT" ? String(input.sourceArtifactId) : null, sourceLabel: sourceType === "CLAUSE" ? sourceClause!.title : sourceItem!.name, targetArtifactId: target.id, targetLabel: target.name, relationshipType: input.relationshipType as Dependency["relationshipType"], status: "APPROVED", origin: "MANUAL", rationale: typeof input.rationale === "string" ? input.rationale : null };
        dependencies.push(edge);
        return response(edge, 201);
      }
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
      if (action === "revisions" && method === "POST") {
        if (typeof input.text === "string" && input.text.trim()) return failure("AI_FAILED", "Clause extraction requires the real API. Development mocks do not generate AI output.", 502);
        if (detail.versions.some(row => row.status === "DRAFT")) return failure("CONFLICT", "A draft already exists.", 409);
        const active = detail.versions.find(row => row.status === "ACTIVE");
        const activeVersion = active ? versions.find(row => row.id === active.id) : undefined;
        if (!active || !activeVersion) return failure("CONFLICT", "An active version is required to create a revision.", 409);
        const revision: VersionDetail = { id: crypto.randomUUID(), policyId: resourceId, versionNumber: Math.max(...detail.versions.map(row => row.versionNumber)) + 1, status: "DRAFT", publishedAt: null, createdAt: new Date().toISOString(), clauses: activeVersion.clauses.map(clause => ({ ...clause, id: crypto.randomUUID(), versionId: "" })) };
        revision.clauses.forEach(clause => { clause.versionId = revision.id; });
        versions.push(revision); detail.versions.unshift(revision);
        return response(revision, 201);
      }
    }

    if (resource === "versions") {
      const version = versions.find(version => version.id === resourceId);
      if (!version) return missing();
      if (!action && method === "GET") return response(version);
      if (action === "publish" && method === "POST") {
        if (version.status !== "DRAFT" || version.clauses.length === 0) return failure("CONFLICT", "Only a non-empty draft can be published.", 409);
        for (const previous of versions) if (previous.policyId === version.policyId && previous.status === "ACTIVE") previous.status = "ARCHIVED";
        version.status = "ACTIVE";
        return response(version);
      }
      if (action === "changes" && method === "GET") {
        const against = url.searchParams.get("against") ?? versions.find(other => other.policyId === version.policyId && other.versionNumber === version.versionNumber - 1)?.id;
        if (!against) return failure("NO_BASE_VERSION", "No earlier version to compare against.", 409);
        const snapshot = data.comparisons?.[`${version.id}:${against}`];
        if (snapshot) return response(snapshot);
        const base = versions.find(other => other.id === against);
        if (!base) return missing();
        const oldClauses = new Map(base.clauses.map(clause => [clause.stableKey, clause]));
        const newClauses = new Map(version.clauses.map(clause => [clause.stableKey, clause]));
        const keys = new Set([...oldClauses.keys(), ...newClauses.keys()]);
        return response([...keys].map(stableKey => {
          const before = oldClauses.get(stableKey) ?? null;
          const after = newClauses.get(stableKey) ?? null;
          return { stableKey, changeType: !before ? "ADDED" : !after ? "REMOVED" : before.text !== after.text ? "MODIFIED" : "UNCHANGED", before, after };
        }));
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
      if (action === "clauses" && !childId && method === "POST") {
        if (version.status !== "DRAFT") return failure("CONFLICT", "Only draft clauses are editable.", 409);
        if (["stableKey", "title", "text", "category"].some(key => typeof input[key] !== "string" || !(input[key] as string).trim())) return failure("VALIDATION_ERROR", "Provide a stable key, title, text, and category.", 400);
        if (version.clauses.some(clause => clause.stableKey === input.stableKey)) return failure("CONFLICT", "Clause key already exists in this version.", 409);
        const clause = { id: crypto.randomUUID(), versionId: version.id, stableKey: String(input.stableKey), title: String(input.title), text: String(input.text), category: String(input.category), position: version.clauses.length };
        version.clauses.push(clause);
        return response(clause, 201);
      }
      if (action === "clauses" && childId && method === "DELETE") {
        if (version.status !== "DRAFT") return failure("CONFLICT", "Only draft clauses are editable.", 409);
        const index = version.clauses.findIndex(clause => clause.id === childId);
        if (index < 0) return missing();
        version.clauses.splice(index, 1);
        return new Response(null, { status: 204 });
      }
    }

    if (resource === "dependencies") {
      const index = dependencies.findIndex(edge => edge.id === resourceId);
      if (index < 0) return missing();
      if (method === "DELETE") { dependencies.splice(index, 1); return new Response(null, { status: 204 }); }
      if (method === "PATCH") {
        if (input.status !== undefined && !["PROPOSED", "APPROVED", "REJECTED"].includes(String(input.status))) return failure("VALIDATION_ERROR", "Provide a valid dependency status.", 400);
        if (input.relationshipType !== undefined && !["GOVERNS", "UPDATES", "APPEARS_IN"].includes(String(input.relationshipType))) return failure("VALIDATION_ERROR", "Provide a valid relationship type.", 400);
        dependencies[index] = { ...dependencies[index], ...input };
        return response(dependencies[index]);
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
