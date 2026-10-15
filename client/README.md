# CareSync frontend

React, TypeScript, Vite, Tailwind CSS, and React Flow. Visual rules are in
`../DESIGN.md`; API shapes are in `../API_CONTRACT.md`.

## Run

Copy `.env.example` to `.env`, install with `npm install`, then run `npm run dev`.
The default API URL is `http://localhost:3000`.

## Development transport

Set `VITE_USE_MOCKS=true` in `.env` and restart Vite to enable the development-only
transport. It is off by default and excluded from production builds, even when
the flag is set. A visible development indicator identifies mock mode.

The transport starts empty and keeps temporary operational items in memory.
Reloading resets them. It supports item CRUD and contract-shaped validation and
not-found errors. Optional typed snapshots accepted by `createMockRequest` let
development checks exercise policy, version, dependency, comparison, and report
read states without populating the running app.

AI extraction/suggestions and impact calculation require the real backend;
mocks never fabricate AI output or calculate impact. Unsupported mutations must
be exercised against the backend. Disable mocks for integration and demos.

## Checks

- `npm run lint`
- `npm run build`
