# PolicyGraph — MVP Specification

This is the source of truth for **today's implementation slice** of the locked PolicyGraph project.

It narrows implementation effort without redefining the full project.

## 1. Goal

A policy owner changes a clause and runs impact analysis to discover downstream operational artifacts that may need review.

Every result must explain **why it appeared** by showing the dependency path from the changed clause.

## 2. Required user flow

```text
Open policy
→ compare active version and draft
→ edit/save draft clause
→ detect MODIFIED clause
→ run impact analysis
→ BFS approved dependencies
→ persist impact run
→ show result list + graph + paths
→ update result review status
```

## 3. Required screens

Only three screens are required.

### `/`

Dashboard.

Show:

- PolicyGraph title
- seeded Travel Reimbursement Policy
- active version
- draft version
- approved dependency count
- latest impact run, if present
- **Open policy** action

### `/policies/:policyId`

Policy comparison.

Show:

- policy title
- active clause
- editable draft clause textarea
- change state
- **Save draft**
- **Run impact analysis**
- **View graph**

For today, do not build a rich Markdown editor.

### `/impact-runs/:impactRunId`

Impact report.

Show both:

1. textual result list
2. dependency graph

Each result contains:

- artifact name
- artifact type
- distance
- reason
- full dependency path
- review status
- Confirm
- Dismiss
- Resolve

Selecting a result should highlight its graph path.

The graph must never be the only representation of an impact.

## 4. Seed scenario

### Policy

```text
Travel Reimbursement Policy
```

### Active clause

Stable key:

```text
TRAVEL-CLAIM-DEADLINE
```

Text:

```text
Employees must submit travel reimbursement claims within 30 days of travel completion.
```

### Draft clause

Same stable key:

```text
TRAVEL-CLAIM-DEADLINE
```

Text:

```text
Employees must submit travel reimbursement claims within 15 days of travel completion.
```

Expected classification:

```text
MODIFIED
```

### Artifacts

```text
Travel Claim Form
type: FORM

Finance Reimbursement Procedure
type: PROCEDURE

Backend Deadline Validation Rule
type: SOFTWARE_RULE
```

### Approved edges

```text
Clause
--IMPLEMENTED_BY-->
Travel Claim Form

Clause
--REFERENCED_BY-->
Finance Reimbursement Procedure

Travel Claim Form
--CONSUMED_BY-->
Backend Deadline Validation Rule
```

### Expected impact results

```text
Travel Claim Form
distance: 1
path:
Clause → Travel Claim Form
```

```text
Finance Reimbursement Procedure
distance: 1
path:
Clause → Finance Reimbursement Procedure
```

```text
Backend Deadline Validation Rule
distance: 2
path:
Clause → Travel Claim Form → Backend Deadline Validation Rule
```

## 5. Minimal data model

### Policy

```text
id
organizationId
title
description?
createdAt
updatedAt
```

### PolicyVersion

```text
id
policyId
versionNumber
status        // ACTIVE | DRAFT
effectiveDate?
createdAt
```

### Clause

```text
id
policyVersionId
stableKey
text
position
textHash
```

### Artifact

```text
id
organizationId
name
type          // FORM | PROCEDURE | SOFTWARE_RULE
description?
criticality   // 1..5
```

### DependencyEdge

```text
id
organizationId

sourceNodeId
sourceNodeType

targetNodeId
targetNodeType

relationshipType
status        // APPROVED | PROPOSED | RETIRED

rationale?
validFrom?
validTo?
```

For today's graph:

- source may be `CLAUSE` or `ARTIFACT`
- target is an `ARTIFACT`

### ImpactRun

```text
id
policyVersionId
createdAt
```

### ImpactResult

```text
id
impactRunId
artifactId
distance
pathJson
reason
reviewStatus     // PROPOSED | CONFIRMED | DISMISSED | RESOLVED
reviewComment?
```

`pathJson` may contain the ordered nodes and edges directly for the MVP.

Do not normalize path storage prematurely.

## 6. Clause change detection

Match predecessor and draft clauses using `stableKey`.

```text
key only in draft
→ ADDED

key only in predecessor
→ REMOVED

same key + different text hash
→ MODIFIED

same key + same text hash
→ UNCHANGED
```

No embeddings, semantic matching, or AI are required.

Only `MODIFIED` must be exercised in the default demo.

## 7. Impact traversal

Impact analysis runs on the backend.

### Inputs

- changed clause IDs
- dependency edges
- optional effective date

### Eligible edges

Traverse only edges that are:

```text
status = APPROVED
```

If validity dates exist, the edge must also be valid at the requested effective date.

### BFS

```text
queue = [(changedClause, pathToClause)]
visited = {changedClause}

while queue not empty:
    current, path = queue.pop_front()

    for edge in approvedOutgoingEdges(current):
        next = edge.target

        if next in visited:
            continue

        visited.add(next)
        nextPath = path + edge + next

        if next is an artifact:
            save impact result with nextPath

        queue.push_back(next, nextPath)
```

Requirements:

- outgoing traversal only
- no infinite loops
- shortest unweighted path is enough
- do not duplicate an artifact result
- persist one complete path per result
- order results by distance, then artifact name

## 8. Required API

### Policy

```http
GET /policies
GET /policies/:id
GET /policies/:id/versions
PATCH /versions/:versionId/clauses/:clauseId
```

### Change detection

```http
GET /versions/:versionId/changes
```

### Graph

```http
GET /policies/:id/graph
```

Suggested shape:

```json
{
  "nodes": [],
  "edges": []
}
```

The response should be easy to map to React Flow.

### Impact

```http
POST /versions/:versionId/impact-runs
GET /impact-runs/:impactRunId
PATCH /impact-results/:impactResultId
```

Creating an impact run must:

1. determine changed clauses
2. run BFS
3. create `ImpactRun`
4. persist `ImpactResult` rows
5. return the complete report

## 9. Frontend components

Keep the component set small.

```text
PolicyCard
VersionComparison
ChangeBadge
ImpactList
ImpactResultCard
DependencyGraph
PathViewer
StatusBadge
```

### Graph behavior

- show artifact/clause names
- label relationship edges
- fit graph into viewport
- selecting an impact highlights its path
- path must also be readable as text

## 10. Required error states

Handle:

- policy/version missing
- API request failed
- no changed clauses
- changed clause has no approved downstream dependencies
- cyclic graph
- empty impact run

## 11. Deferred features

Not required today:

- AI rule suggestions
- conflict detection
- approval workflow
- scheduled activation
- acknowledgement workflow
- notifications
- policy search
- audit explorer
- report export
- historical lookup
- rich Markdown editing
- automatic dependency discovery
- PDF/DOCX extraction
- production multi-tenant administration

## 12. Acceptance checklist

- [ ] seeded policy loads
- [ ] active and draft clauses render
- [ ] draft clause can be edited and saved
- [ ] 30 → 15 produces `MODIFIED`
- [ ] graph displays seeded nodes and edges
- [ ] BFS finds direct artifacts
- [ ] BFS finds the indirect software-rule artifact
- [ ] cycles cannot loop traversal
- [ ] unapproved edges are ignored
- [ ] every impact has a full path
- [ ] impact run persists in PostgreSQL
- [ ] review status can be updated
- [ ] updated status survives refresh
- [ ] complete demo requires no manual database editing
