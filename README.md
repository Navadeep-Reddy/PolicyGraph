# PolicyGraph

**Explainable Organisational Policy Change Impact Analysis**

PolicyGraph answers:

> When this policy clause changes, what forms, procedures, or software rules might also need review?

The system stores verified dependencies between policy clauses and operational artifacts. When a clause changes, the backend traverses those dependencies with BFS and returns explainable impact paths.

## Start here

Repository instructions are intentionally split by responsibility:

| File | Purpose |
|---|---|
| `AGENTS.md` | Rules and operating context for Codex/coding agents |
| `MVP_SPEC.md` | What today's MVP must do |
| `BUILD_PLAN.md` | What order to build it in |
| `README.md` | Human entry point and setup |

Agents should read `AGENTS.md` first. Product behavior must stay aligned with `MVP_SPEC.md`.

## One-day MVP

Build one convincing vertical slice:

```text
policy version change
→ changed clause
→ verified dependency graph
→ BFS impact analysis
→ explainable impacted artifacts
→ human review status
```

### Canonical demo

Travel reimbursement deadline:

```text
30 days → 15 days
```

Dependencies:

```text
Clause
├── IMPLEMENTED_BY → Travel Claim Form
├── REFERENCED_BY  → Finance Reimbursement Procedure
└── via Travel Claim Form
    └── CONSUMED_BY → Backend Deadline Validation Rule
```

The backend validation rule must therefore appear as an **indirect impact** with a complete path.

## Stack

### Client

- React
- TypeScript
- Vite
- Tailwind CSS
- `@xyflow/react`

### Server

- NestJS
- TypeScript
- Prisma
- PostgreSQL

### Later / optional

- Supabase Auth
- Vercel frontend deployment
- backend service/VM
- Supabase-hosted PostgreSQL

Authentication is part of the full project, but it is not allowed to block today's core demo.

## Suggested repository

```text
policygraph/
├── AGENTS.md
├── README.md
├── MVP_SPEC.md
├── BUILD_PLAN.md
├── client/
└── server/
```

## Bootstrap

### Client

```bash
npm create vite@latest client -- --template react-ts
cd client
npm install
npm install @xyflow/react
npm install tailwindcss @tailwindcss-vite
```

Use the current Tailwind Vite integration when configuring the project.

### Server

```bash
npm install -g @nestjs/cli
nest new server --strict
cd server
npm install prisma @prisma/client
npx prisma init
```

Configure `DATABASE_URL` for PostgreSQL before creating the first migration.

## Do not overbuild

Today's MVP does **not** require:

- AI suggestions
- complex RBAC screens
- approval workflows
- scheduled activation
- acknowledgements
- conflict scanning
- notifications
- exports
- Neo4j
- semantic search
- PDF/DOCX ingestion

Those belong to the larger PolicyGraph project and can be added after the core value proposition works.

## Demo success

The MVP is ready when you can perform this entirely in the browser:

1. Open **Travel Reimbursement Policy**.
2. Compare the active `30 day` clause with the draft `15 day` clause.
3. See `MODIFIED`.
4. Click **Run impact analysis**.
5. See:
   - Travel Claim Form
   - Finance Reimbursement Procedure
   - Backend Deadline Validation Rule
6. Select the backend rule.
7. See:

```text
TRAVEL-CLAIM-DEADLINE
→ Travel Claim Form
→ Backend Deadline Validation Rule
```

8. Mark an impact resolved.
9. Refresh and confirm it remains resolved.
