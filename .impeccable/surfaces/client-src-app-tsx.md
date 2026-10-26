---
version: 1
slug: "client-src-app-tsx"
primary_target: "client/src/App.tsx"
related_targets: ["client/src/index.css","client/src/pages/DashboardPage.tsx"]
---

# CareSync application redesign

## Surface
Whole CareSync web application · Operate.

## Audience and task
Hospital staff inspect policy versions, maintain operational items and dependencies, compare revisions, and review explainable impact. Dashboard success is seeing policy status and opening the right next action quickly. Preserve the existing routes, workflow, language, API data, error/loading/empty states, and text equivalents for graphs.

## Direction contract

THESIS: CareSync’s dependency path is a route through policy operations: the dashboard is a readable policy register, while graphs and impact paths borrow the clarity of metropolitan transit wayfinding. Refuse decorative dashboards that hide names and status behind abstract metrics.

OWN-WORLD: Midnight-blue navigation and graph grounds; porcelain work surfaces; route inks in scarlet, cobalt, amber, and green, always paired with labels and a text equivalent. Use crisp humanist sans typography, aligned table columns, 45°/90° route turns, station-like relationship nodes, and explicit interchange labels. Standard web navigation and controls remain familiar. Mobile focuses the selected path while keeping its text route visible.

STORY: Staff see active and draft policy states first, then can inspect versions, maintain items, review dependencies, compare clause wording, and follow a changed clause through approved operational links. Every state remains explicit in words; route colors reinforce, never replace, meaning.

FIRST VIEWPORT: A fixed-width midnight rail names Dashboard, New policy, Operational items, and current-policy links. The light workspace begins with the Policies title and one New policy action, followed by a compact status strip and a policy register with policy name, active version, draft state, approved dependencies, and latest impact. A selected route summary appears beside the register only when meaningful data exists. The signature move is an orthogonal, labeled route through nodes on dependency and impact screens, paired with the existing accessible relationship/path table.

FORM: Challenger transit diagram, the challenger that beat the dealt variable-font-specimen leader on audience identification and product clarity; seed:1c5bbf4237991858.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
None. All current routes and actions remain in scope; no fabricated data or new product claims.
