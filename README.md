# CareSync

**Hospital Policy Change Impact Tracker**

CareSync answers:

> When a hospital operational policy changes, which procedures, checklists, forms, instructions, and training materials should staff review?

The system uses AI to propose clauses and dependencies, a human to confirm them, and deterministic BFS traversal over the confirmed dependencies to produce explainable impact paths.

CareSync is **not** a clinical system. It does not handle patient records, diagnosis, or treatment, and it does not guarantee compliance.

## Start here

Repository instructions are intentionally split by responsibility:

| File | Purpose |
|---|---|
| `AGENTS.md` | Rules and operating context for coding agents |
| `SPEC.md` | What the product must do |
| `BUILD_PLAN.md` | What order to build it in, tagged by Backend / Frontend / Integration; also the progress tracker |
| `API_CONTRACT.md` | Endpoints and JSON shapes shared by frontend and backend |
| `DESIGN.md` | Visual design language. Canonical for all UI work and never edited by agents |
| `README.md` | Human entry point and setup |

Agents should read `AGENTS.md` first. Product behavior must stay aligned with `SPEC.md`.

## Core idea

```text
paste policy text
→ AI extracts clauses → human reviews/edits → publish version
→ add operational items
→ AI suggests dependencies → human approves/rejects (or adds manually)
→ create revision → edit draft → compare versions
→ BFS impact analysis over approved dependencies
→ explainable impact report → human review status
```

The app starts **empty**. There is no seed data and no hardcoded demo. Every policy, clause, item, and dependency is entered through the app.

### Example dependency shape

```text
Visitor-hours clause
├── GOVERNS    → Security desk procedure
├── UPDATES    → Ward visitor checklist
├── APPEARS_IN → Visitor information sheet
└── via Security desk procedure
    └── UPDATES → Staff training material
```

The training material must appear as an **indirect impact** with a complete path.

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
- Hosted Supabase PostgreSQL (free tier). No Docker, no local database.
- NVIDIA Nemotron through an OpenAI-compatible API (`openai` npm package)
- PDF text extraction and OCR-candidate page transcription through a local OpenAI-compatible Qwen vision server such as Ollama (`openai` npm package)

There is no authentication.

## Local setup

Prerequisites: Node.js 24 LTS (24.15 or newer) + npm, a free Supabase account, an NVIDIA API key.

### 1. Supabase (hosted)

A coding agent can do this with the Supabase CLI:

```bash
npx supabase login
npx supabase projects create caresync --org-id <org-id> --db-password <password> --region <region>
```

Then copy the connection strings (Supabase dashboard → **Connect**) into `server/.env`:

- `DATABASE_URL`: pooled connection, used by the running app
- `DIRECT_URL`: direct connection, used by Prisma migrations

Free-tier projects pause after inactivity. Resume the project in the dashboard if the server cannot connect.

### 2. Server (API on `http://localhost:3000`)

```bash
cd server
cp .env.example .env
```

Fill in `server/.env` with your Supabase connection strings and all three NVIDIA settings shown below before continuing:

```bash
npm ci
npm run db:generate
npx prisma migrate deploy
npm run start:dev
```

`server/.env`:

```text
DATABASE_URL=
DIRECT_URL=
NVIDIA_API_KEY=
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=nvidia/nemotron-3.5-super-vl-120b-a12b
# Optional; required only when imported PDF pages need OCR. Ollama example:
QWEN_OCR_API_KEY=local
QWEN_OCR_BASE_URL=http://localhost:11434/v1
QWEN_OCR_MODEL=qwen3-vl:8b
```

Install and run a vision-capable Qwen model in Ollama before importing scanned PDFs. The `QWEN_OCR_MODEL` name/tag must exactly match a model installed locally; configure the API key, base URL, and model only through these `.env` variables.

Prisma client generation is required on a clean clone; the generated client is not committed. `prisma migrate deploy` applies the checked-in migrations without creating a shadow database. Use `npm run db:migrate` when developing a new schema migration.

Reset the database (wipes all data and re-applies migrations):

```bash
npm run db:reset
```

### 3. Client (app on `http://localhost:5173`)

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

`client/.env`:

```text
VITE_API_URL=http://localhost:3000
VITE_USE_MOCKS=false
```

`VITE_USE_MOCKS=true` is a development aid for building the UI before the backend is ready. See `AGENTS.md`.

### Optional readable demo data

To deliberately load a readable visitor-policy sample into the configured Supabase database, run this from `server/`:

```bash
npm run db:demo
```

This opt-in script is not automatic and its sample content is manually authored, not AI-produced. Every invocation **deletes all CareSync application records, including user-added data and impact reports**, then restores the same baseline: Hospital Visitor Policy with version 1 ACTIVE (8:00 PM) and version 2 DRAFT (6:00 PM), plus unchanged registration and badge clauses. It adds Security Desk Procedure, Ward Visitor Checklist, Visitor Information Sheet, and Visitor Access Training, connected by four approved manual dependencies. It creates no impact runs. The reset and restore run in one transaction; a failure rolls back the reset.

### Browser walkthrough (you enter all data)

1. Open `http://localhost:5173` and click **New policy**.
2. Paste policy text, for example a visitor policy that says visitors are permitted until 8:00 PM.
3. Review and edit the AI-extracted clauses, then **Publish version**.
4. Open **Operational items** and add items (for example a security desk procedure, a ward checklist, a visitor information sheet).
5. Open the policy's **Dependencies** screen, click **Suggest dependencies**, then approve, edit, or reject each suggestion. Add any missed dependency manually.
6. Click **Create revision**, change the clause to 6:00 PM, and open **Compare**.
7. Confirm the clause reads `MODIFIED`, then click **Run impact analysis**.
8. Inspect each affected item's dependency path.
9. Mark a result resolved, refresh, and confirm it stays resolved.

## Do not overbuild

CareSync does **not** include:

- patient records, clinical diagnosis, or treatment recommendations
- login or roles
- integration with hospital systems
- DOCX extraction (PDF import and page transcription OCR are supported)
- email or notifications
- approval workflows
- report export
- graph or vector databases
- AI fallback responses
- seeded demo data

## Demo success

You can perform the full walkthrough above entirely in the browser, starting from an empty database, with no manual database editing.
