# CareSync — API Contract

Single source of truth for endpoints and JSON shapes. Backend implements it; frontend builds against it. Change it only per the rules in `AGENTS.md`.

## Conventions

- Base URL: `VITE_API_URL` (default `http://localhost:3000`)
- JSON only. Dates are ISO 8601 strings. IDs are strings.
- No authentication.
- Frontend UI says "operational item"; the API says `artifact` / `items`.

### Errors

All errors use this shape:

```json
{ "error": { "code": "NOT_FOUND", "message": "Policy not found" } }
```

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request body or params |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Action not allowed in current state (draft already exists, version not a draft, nothing to publish, duplicate dependency) |
| `NO_BASE_VERSION` | 409 | No earlier version to compare or analyse against |
| `AI_FAILED` | 502 | AI call failed or returned unusable output. Nothing was saved |

## Enums

```ts
type VersionStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
type ArtifactType = 'FORM' | 'PROCEDURE' | 'CHECKLIST' | 'TRAINING_MATERIAL'
                  | 'DEPARTMENT_INSTRUCTION' | 'INFORMATION_SHEET';
type RelationshipType = 'GOVERNS' | 'UPDATES' | 'APPEARS_IN';
type DependencyStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED';
type DependencyOrigin = 'AI' | 'MANUAL';
type ChangeType = 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';
type ReviewStatus = 'PROPOSED' | 'CONFIRMED' | 'DISMISSED' | 'RESOLVED';
```

## Types

```ts
interface PolicySummary {
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

interface Version {
  id: string;
  policyId: string;
  versionNumber: number;
  status: VersionStatus;
  publishedAt: string | null;
  createdAt: string;
}

interface Clause {
  id: string;
  versionId: string;
  stableKey: string;      // e.g. "VISITOR-HOURS-01"
  title: string;
  text: string;
  category: string;       // snake_case, e.g. "visitor_access"
  position: number;
}

interface PolicyDetail {
  id: string;
  title: string;
  description: string | null;
  versions: Version[];    // newest first
}

interface VersionDetail extends Version {
  clauses: Clause[];      // ordered by position
}

interface Item {
  id: string;
  name: string;
  type: ArtifactType;
  department: string;
  description: string | null;
  content: string | null;
}

interface Dependency {
  id: string;
  policyId: string;
  sourceType: 'CLAUSE' | 'ARTIFACT';
  sourceClauseKey: string | null;    // set when sourceType = CLAUSE
  sourceArtifactId: string | null;   // set when sourceType = ARTIFACT
  sourceLabel: string;
  targetArtifactId: string;
  targetLabel: string;
  relationshipType: RelationshipType;
  status: DependencyStatus;
  origin: DependencyOrigin;
  rationale: string | null;
}

interface GraphNode {
  id: string;             // "clause:<stableKey>" or "artifact:<id>"
  type: 'CLAUSE' | 'ARTIFACT';
  label: string;
  subtitle: string | null; // item type and department for artifacts
}

interface GraphEdge {
  id: string;             // dependency id
  source: string;         // GraphNode.id
  target: string;         // GraphNode.id
  relationshipType: RelationshipType;
  status: DependencyStatus;
}

interface ClauseChange {
  stableKey: string;
  changeType: ChangeType;
  before: Clause | null;  // null when ADDED
  after: Clause | null;   // null when REMOVED
}

interface PathNode { id: string; type: 'CLAUSE' | 'ARTIFACT'; label: string }
interface PathEdge { id: string; relationshipType: RelationshipType }

interface ImpactResult {
  id: string;
  changedClauseKey: string;
  artifact: { id: string; name: string; type: ArtifactType; department: string };
  distance: number;
  reason: string;         // template text built from the path
  path: { nodes: PathNode[]; edges: PathEdge[] };  // nodes.length = edges.length + 1
  reviewStatus: ReviewStatus;
  reviewComment: string | null;
}

interface ImpactReport {
  id: string;
  policyId: string;
  policyTitle: string;
  versionId: string;
  baseVersionId: string;
  createdAt: string;
  changedClauses: { stableKey: string; changeType: ChangeType; oldText: string | null; newText: string | null }[];
  affectedDepartments: string[];
  results: ImpactResult[];  // ordered by distance, then artifact name
}
```

## Endpoints

### Health

```http
GET /health
→ 200 { "status": "ok" }
```

### Policies and versions

```http
POST /policies/import
Content-Type: multipart/form-data (file: required PDF, title: required nonblank, description?: string)
→ 201 { "policy": PolicyDetail, "draft": VersionDetail }
```
Imports PDFs up to 15 MiB and 100 pages with embedded-text extraction and page transcription OCR where needed. The extracted transcription follows the same clause-extraction path as `POST /policies`. Invalid, encrypted, malformed, or textless PDFs return `VALIDATION_ERROR` (400); OCR failures return `AI_FAILED` (502). Multipart size-limit errors also use the standard `{error:{code,message}}` shape.

```http
GET /policies
→ 200 PolicySummary[]
```

```http
POST /policies
{ "title": string, "description"?: string, "text": string }
→ 201 { "policy": PolicyDetail, "draft": VersionDetail }
```
Creates the policy and draft version 1, runs AI clause extraction. Errors: `VALIDATION_ERROR`, `AI_FAILED`.

```http
GET /policies/:id
→ 200 PolicyDetail
```

```http
GET /versions/:versionId
→ 200 VersionDetail
```

```http
POST /policies/:id/revisions
{ "text"?: string }
→ 201 VersionDetail
```
Creates a draft by copying the active version's clauses with the same stable keys. If `text` is given, the AI re-extracts clauses and is told to reuse existing keys where clauses match. Errors: `CONFLICT` (a draft exists or there is no active version), `AI_FAILED`.

```http
POST /versions/:versionId/publish
→ 200 VersionDetail
```
Makes the draft `ACTIVE` and the previous active version `ARCHIVED`. Errors: `CONFLICT` (not a draft, or no clauses).

### Draft clauses

```http
POST /versions/:versionId/clauses
{ "stableKey": string, "title": string, "text": string, "category": string }
→ 201 Clause
```

```http
PATCH /versions/:versionId/clauses/:clauseId
{ "title"?: string, "text"?: string, "category"?: string }
→ 200 Clause
```

```http
DELETE /versions/:versionId/clauses/:clauseId
→ 204
```
All three: draft versions only, otherwise `CONFLICT`. `POST` returns `CONFLICT` if the key already exists in the version.

### Comparison

```http
GET /versions/:versionId/changes?against=:otherVersionId
→ 200 ClauseChange[]
```
`against` is optional; it defaults to the previous version number. Errors: `NO_BASE_VERSION`.

### Operational items

```http
GET /items
→ 200 Item[]

POST /items
{ "name": string, "type": ArtifactType, "department": string, "description"?: string, "content"?: string }
→ 201 Item

PATCH /items/:id
{ any field of POST /items }
→ 200 Item

DELETE /items/:id
→ 204
```
Deleting an item also deletes its dependencies.

### Dependencies

```http
GET /policies/:id/dependencies?status=PROPOSED|APPROVED|REJECTED
→ 200 Dependency[]
```
`status` is optional.

```http
POST /policies/:id/dependencies
{
  "sourceType": "CLAUSE" | "ARTIFACT",
  "sourceClauseKey"?: string,
  "sourceArtifactId"?: string,
  "targetArtifactId": string,
  "relationshipType": RelationshipType,
  "rationale"?: string
}
→ 201 Dependency
```
Manual creation: saved as `APPROVED`, origin `MANUAL`. Errors: `VALIDATION_ERROR` (unknown key or id, self-link), `CONFLICT` (duplicate source + target + type).

```http
PATCH /dependencies/:id
{ "status"?: DependencyStatus, "relationshipType"?: RelationshipType, "rationale"?: string }
→ 200 Dependency
```

```http
DELETE /dependencies/:id
→ 204
```

```http
POST /policies/:id/dependency-suggestions
{ "versionId"?: string }
→ 201 { "created": Dependency[], "skipped": number }
```
Uses the given version, otherwise the draft, otherwise the active version. Saves valid suggestions as `PROPOSED`, origin `AI`. `skipped` counts discarded invalid or duplicate suggestions. Errors: `AI_FAILED`.

### Graph

```http
GET /policies/:id/graph?versionId=:versionId
→ 200 { "nodes": GraphNode[], "edges": GraphEdge[] }
```
`versionId` is optional; it defaults to the draft, otherwise the active version. Includes `PROPOSED` and `APPROVED` edges (`REJECTED` excluded). Edges whose clause key is absent from the version are omitted.

### Impact

```http
POST /versions/:versionId/impact-runs
→ 201 ImpactReport
```
Compares the draft with its previous version, runs BFS from every `MODIFIED` or `REMOVED` clause over `APPROVED` edges, persists the run and results. If nothing changed, returns a run with empty `changedClauses` and `results`. Errors: `NO_BASE_VERSION`.

```http
GET /impact-runs/:id
→ 200 ImpactReport
```

```http
GET /versions/:versionId/impact-runs
→ 200 { "id": string, "createdAt": string, "resultCount": number }[]
```
Newest first.

```http
PATCH /impact-results/:id
{ "reviewStatus": ReviewStatus, "reviewComment"?: string }
→ 200 ImpactResult
```
