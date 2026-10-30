import type {
  ApiErrorCode, Clause, ClauseChange, CreateClauseInput, CreateDependencyInput,
  CreateItemInput, CreatePolicyInput, CreatePolicyResponse, Dependency,
  DependencyStatus, DependencySuggestions, ImpactReport, ImpactResult,
  ImpactRunSummary, Item, PolicyDetail, PolicyGraph, PolicySummary,
  ReviewStatus, UpdateClauseInput, UpdateDependencyInput, VersionDetail,
} from "../types/index.ts";
import { requestMessage, trackRequest } from "./activity.ts";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "");
export const mocksEnabled = import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === "true";

export class ApiError extends Error {
  status: number;
  code: ApiErrorCode | "REQUEST_FAILED";

  constructor(status: number, message: string, code: ApiErrorCode | "REQUEST_FAILED" = "REQUEST_FAILED") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const inFlightReads = new Map<string, Promise<unknown>>();

function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isRead = !init?.method || init.method === "GET";
  const pending = isRead ? inFlightReads.get(path) : undefined;
  if (pending) return pending as Promise<T>;
  const operation = trackRequest(requestMessage(path, init?.method), () => sendRequest<T>(path, init));
  if (!isRead) return operation;
  // Coalesce concurrent reads (including StrictMode effects), without caching
  // completed responses that could hide later edits.
  const result = operation.finally(() => { inFlightReads.delete(path); });
  inFlightReads.set(path, result);
  return result;
}

async function sendRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body !== undefined) headers.set("Content-Type", "application/json");
  const options = { ...init, headers };
  const response = mocksEnabled
    ? await (await import("./mocks.ts")).mockRequest(path, options)
    : await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    let code: ApiError["code"] = "REQUEST_FAILED";
    const body: unknown = await response.json().catch(() => null);
    if (isRecord(body) && isRecord(body.error)) {
      if (typeof body.error.message === "string") message = body.error.message;
      const knownCodes: string[] = ["VALIDATION_ERROR", "NOT_FOUND", "CONFLICT", "NO_BASE_VERSION", "AI_FAILED"];
      if (typeof body.error.code === "string" && knownCodes.includes(body.error.code)) code = body.error.code as ApiErrorCode;
    }
    throw new ApiError(response.status, message, code);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

function multipartRequest<T>(path: string, init: RequestInit): Promise<T> {
  return trackRequest(requestMessage(path, init.method), () => sendMultipartRequest<T>(path, init));
}

async function sendMultipartRequest<T>(path: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  const response = mocksEnabled
    ? await (await import("./mocks.ts")).mockRequest(path, { ...init, headers })
    : await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    let code: ApiError["code"] = "REQUEST_FAILED";
    const body: unknown = await response.json().catch(() => null);
    if (isRecord(body) && isRecord(body.error)) {
      if (typeof body.error.message === "string") message = body.error.message;
      const knownCodes: string[] = ["VALIDATION_ERROR", "NOT_FOUND", "CONFLICT", "NO_BASE_VERSION", "AI_FAILED"];
      if (typeof body.error.code === "string" && knownCodes.includes(body.error.code)) code = body.error.code as ApiErrorCode;
    }
    throw new ApiError(response.status, message, code);
  }
  return await response.json() as T;
}

const id = encodeURIComponent;
const json = (method: string, body?: unknown): RequestInit => ({
  method, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const getHealth = () => request<{ status: "ok" }>("/health");
export const listPolicies = () => request<PolicySummary[]>("/policies");
export const createPolicy = (input: CreatePolicyInput) => request<CreatePolicyResponse>("/policies", json("POST", input));
export const createPolicyFromPdf = (input: { file: File; title: string; description?: string }) => {
  const form = new FormData();
  form.append("file", input.file);
  form.append("title", input.title);
  if (input.description !== undefined) form.append("description", input.description);
  return multipartRequest<CreatePolicyResponse>("/policies/import", { method: "POST", body: form });
};
export const getPolicy = (policyId: string) => request<PolicyDetail>(`/policies/${id(policyId)}`);
export const getVersion = (versionId: string) => request<VersionDetail>(`/versions/${id(versionId)}`);
export const createRevision = (policyId: string, input: { text?: string } = {}) =>
  request<VersionDetail>(`/policies/${id(policyId)}/revisions`, json("POST", input));
export const publishVersion = (versionId: string) => request<VersionDetail>(`/versions/${id(versionId)}/publish`, json("POST"));
export const createClause = (versionId: string, input: CreateClauseInput) =>
  request<Clause>(`/versions/${id(versionId)}/clauses`, json("POST", input));
export const updateClause = (versionId: string, clauseId: string, input: UpdateClauseInput) =>
  request<Clause>(`/versions/${id(versionId)}/clauses/${id(clauseId)}`, json("PATCH", input));
export const deleteClause = (versionId: string, clauseId: string) =>
  request<void>(`/versions/${id(versionId)}/clauses/${id(clauseId)}`, json("DELETE"));
export const getVersionChanges = (versionId: string, against?: string) =>
  request<ClauseChange[]>(`/versions/${id(versionId)}/changes${against === undefined ? "" : `?${new URLSearchParams({ against })}`}`);
export const listItems = () => request<Item[]>("/items");
export const createItem = (input: CreateItemInput) => request<Item>("/items", json("POST", input));
export const updateItem = (itemId: string, input: Partial<CreateItemInput>) => request<Item>(`/items/${id(itemId)}`, json("PATCH", input));
export const deleteItem = (itemId: string) => request<void>(`/items/${id(itemId)}`, json("DELETE"));
export const listDependencies = (policyId: string, status?: DependencyStatus) =>
  request<Dependency[]>(`/policies/${id(policyId)}/dependencies${status === undefined ? "" : `?${new URLSearchParams({ status })}`}`);
export const createDependency = (policyId: string, input: CreateDependencyInput) =>
  request<Dependency>(`/policies/${id(policyId)}/dependencies`, json("POST", input));
export const updateDependency = (dependencyId: string, input: UpdateDependencyInput) =>
  request<Dependency>(`/dependencies/${id(dependencyId)}`, json("PATCH", input));
export const deleteDependency = (dependencyId: string) => request<void>(`/dependencies/${id(dependencyId)}`, json("DELETE"));
export const suggestDependencies = (policyId: string, versionId?: string) =>
  request<DependencySuggestions>(`/policies/${id(policyId)}/dependency-suggestions`, json("POST", versionId === undefined ? {} : { versionId }));
export const getPolicyGraph = (policyId: string, versionId?: string) =>
  request<PolicyGraph>(`/policies/${id(policyId)}/graph${versionId === undefined ? "" : `?${new URLSearchParams({ versionId })}`}`);
export const createImpactRun = (versionId: string) => request<ImpactReport>(`/versions/${id(versionId)}/impact-runs`, json("POST"));
export const listImpactRuns = (versionId: string) => request<ImpactRunSummary[]>(`/versions/${id(versionId)}/impact-runs`);
export const getImpactRun = (impactRunId: string) => request<ImpactReport>(`/impact-runs/${id(impactRunId)}`);
export const updateImpactResult = (impactResultId: string, reviewStatus: ReviewStatus, reviewComment?: string) =>
  request<ImpactResult>(`/impact-results/${id(impactResultId)}`, json("PATCH", { reviewStatus, ...(reviewComment === undefined ? {} : { reviewComment }) }));

export function humanRelationshipLabel(type: string): string {
  return type.toLowerCase().replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase());
}

export const humanArtifactType = humanRelationshipLabel;
