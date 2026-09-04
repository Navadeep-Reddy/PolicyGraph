# PolicyGraph — Design System

This document captures the visual language and interaction patterns established by the current PolicyGraph MVP UI.

Use it together with:

- `AGENTS.md`
- `MVP_SPEC.md`
- `BUILD_PLAN.md`

`DESIGN.md` defines **how the product should look and feel**. It does not redefine product behavior.

---

## 1. Design intent

PolicyGraph should feel like a **modern internal productivity/developer tool** for policy traceability and impact analysis.

The interface should be:

- calm
- precise
- spacious
- analytical
- modern
- highly legible
- visually restrained
- serious without feeling like legacy enterprise software

The interface should communicate the core PolicyGraph flow visually:

```text
policy change
→ changed clause
→ dependency path
→ affected artifact
→ review decision
```

Prefer visual hierarchy and structure over explanatory prose.

Avoid generic SaaS dashboard patterns, fake telemetry, excessive cards, dense enterprise tables, and decorative complexity.

---

## 2. Core visual principles

### 2.1 One dominant idea per screen

Each screen should have one clear visual purpose.

```text
Overview
→ What changed?

Policy comparison
→ What is different?

Dependency graph
→ What depends on this clause?

Impact analysis
→ What is affected and why?
```

Secondary information must not compete with the primary task.

### 2.2 Graphs are first-class UI

The dependency graph is not decoration.

When present, it should occupy a meaningful portion of the workspace and remain readable at normal zoom.

### 2.3 Prefer whitespace over chrome

Use:

- spacing
- alignment
- subtle borders
- restrained surfaces

instead of:

- nested cards
- heavy shadows
- thick separators
- excessive badges
- dense information blocks

### 2.4 Human-readable language

Use product-facing labels such as:

- `Implements`
- `References`
- `Feeds into`

rather than database-style relationship names such as:

- `IMPLEMENTED_BY`
- `REFERENCED_BY`
- `CONSUMED_BY`

Technical identifiers may still appear as secondary metadata.

---

## 3. Color system

### Brand

```text
brand               #174C3C
brand-dark          #0F3529
brand-light         #EAF2EE
brand-subtle        #F0F4F1
```

Use deep forest green as the primary identity color.

Primary actions, active navigation, selected graph states, and confirmed/positive interactions may use brand green.

### Canvas and surfaces

```text
canvas              #F7F7F5
card                #FFFFFF
border              #E6E7E4
```

The app should never feel pure white edge-to-edge.

Use the warm neutral canvas as the default page background.

### Change accent

```text
amber               #D98B37
amber-light         #FBF3EA
```

Amber represents:

- changed values
- affected nodes
- proposed impact state
- policy mutation emphasis

Do not overuse amber elsewhere.

### Neutral stone scale

```text
stone-50            #FAFAF9
stone-100           #F5F5F4
stone-200           #E7E5E4
stone-300           #D6D3D1
stone-400           #A8A29E
stone-500           #78716C
stone-600           #57534E
stone-700           #44403C
stone-800           #292524
stone-900           #1C1917
```

Most interface text and borders should use this neutral scale.

---

## 4. Typography

### Primary UI font

```text
Geist
fallback: Inter, sans-serif
```

Use Geist for navigation, page titles, labels, buttons, cards, and general UI.

### Body font

```text
Inter
fallback: sans-serif
```

Use Inter where longer body copy appears.

### Monospace

```text
JetBrains Mono
fallback: Geist, monospace
```

Use monospace sparingly for:

- clause keys
- node IDs
- stable identifiers
- technical relationship metadata

Do not use monospace for general navigation or body text.

### Type scale

Recommended UI scale:

```text
Page title             30px / bold
Section title          18px / semibold
Important values       24–36px / semibold or bold
Primary UI text        13.5–15px
Secondary text         12–13px
Small metadata         10–11.5px
```

Never make the interface depend on very tiny text for comprehension.

---

## 5. Spacing and shape

### Page spacing

```text
Main content padding       32px
Section gap                24px
Card internal padding      20px
Compact row padding        12px
Sidebar width              200px
Top bar height             64px
```

### Radius

```text
Main panels                12px
Controls                   8px
Small tags                 6px
Icon containers            8px
```

Do not turn every element into a pill.

### Borders

Default:

```text
1px solid #E6E7E4
```

Borders should be subtle and structural.

### Shadows

Use very light shadows only where layering needs to be communicated.

Prefer no shadow over decorative shadow.

---

## 6. App shell

### Sidebar

Persistent desktop sidebar:

```text
width: 200px
background: #FFFFFF
right border: #E6E7E4
```

Structure:

```text
PolicyGraph

Overview
Policies
Impact Runs


User
```

Active navigation uses:

- `brand-subtle` background
- `brand` text/icon
- semibold label

Inactive navigation uses neutral text with a light hover state.

Do not add unnecessary workspace stats, graph status, system version, or monitoring data.

### Top bar

Height:

```text
64px
```

Use only lightweight contextual navigation and genuinely useful utility controls.

Breadcrumbs are preferred over large secondary headers.

---

## 7. Panel language

Primary working panels use:

```text
background: white
border: neutral
radius: 12px
padding: 20px
```

Do not nest multiple visual cards unless the hierarchy truly requires it.

A panel should normally contain one coherent task:

- impacted artifact list
- dependency path
- version comparison
- policy summary

---

## 8. Buttons

### Primary

Use for the main action on a screen.

```text
background: brand
text: white
hover: brand-dark
radius: 8px
```

Examples:

- Run impact analysis
- Mark resolved
- Save

### Secondary outlined

```text
background: white
border: brand or neutral
text: brand or stone-800
```

Examples:

- Confirm impact
- View graph

### Quiet / text action

Use for low-priority actions.

Examples:

- Dismiss
- Back
- Cancel

Buttons should be compact and professional, not oversized marketing CTAs.

---

## 9. Status treatment

Use compact labels, dots, or subtle tags.

Primary MVP states include:

```text
ACTIVE
DRAFT
MODIFIED
PROPOSED
CONFIRMED
DISMISSED
RESOLVED
APPROVED
```

Guidelines:

- `PROPOSED` may use amber
- selected/active states may use brand green
- resolved states should become visually quieter
- do not saturate the interface with status colors

Status should never rely on color alone.

---

## 10. Impact artifact list

Artifact results should use **selectable rows**, not large cards.

Each row contains:

```text
Artifact name
Artifact type · relationship distance
Status
```

Example:

```text
Backend Deadline Validation Rule
Software rule · 2 hops away
Proposed
```

Selected state:

- `brand-subtle` background
- 3px left brand accent
- stronger artifact name
- optional brand-tinted icon container

Keep rows easy to scan.

Do not add long descriptions directly into the list.

---

## 11. Review controls

For a selected impact, show:

```text
Dismiss
Confirm impact
Mark resolved
```

Optional note input:

```text
Add optional triage note...
```

The note field should remain visually quiet.

Prefer inline controls over large modals.

Feedback should use a small contextual toast or inline confirmation.

---

## 12. Dependency graph visual language

The graph should use an open, spacious canvas.

### Graph canvas

```text
background: #F7F7F5
border: #E6E7E4
radius: 8–12px
```

A subtle dot grid may be used:

```text
dot: #D6D3D1
dot size: ~1px
grid spacing: ~20px
```

This is optional but appropriate for graph-oriented screens.

### Node structure

Nodes are white rectangular surfaces with subtle borders and 12px radius.

#### Policy clause node

Visual identity:

- green icon block
- monospace stable key
- small `Policy clause` label

Example:

```text
Policy clause
TRAVEL-CLAIM-DEADLINE
```

#### Form node

```text
Form
Travel Claim Form
```

Use a neutral document/form icon.

#### Procedure node

```text
Procedure
Finance Reimbursement Procedure
```

Use a neutral workflow/procedure icon.

#### Software rule node

```text
Software rule
Backend Deadline Validation Rule
```

Use a code/rule icon.

### Affected target

When a node is the selected affected artifact:

- amber-light surface
- amber border
- amber icon block
- optional compact `AFFECTED` tag

Do not make the entire graph orange.

### Dimmed nodes

When highlighting a selected path, unrelated nodes may be reduced to roughly:

```text
25–35% opacity
```

The active path must remain visually dominant.

---

## 13. Graph edges

Use clear directional connectors.

Preferred human-readable relationship labels:

```text
Implements
References
Feeds into
```

A path should be readable even if color is removed.

Use:

- visible arrows
- clear edge labels
- gentle curves or simple vertical connectors
- minimal visual decoration

---

## 14. Path explanation

The selected path is a core PolicyGraph interaction.

It should be shown visually and textually.

Example:

```text
TRAVEL-CLAIM-DEADLINE
        ↓ Implements
Travel Claim Form
        ↓ Feeds into
Backend Deadline Validation Rule
```

Also show compact metadata:

```text
2 hops · Approved dependencies
```

Avoid explaining BFS or internal graph logic in the UI.

The user only needs to understand the causal path.

---

## 15. Change presentation

Policy mutations should be immediately recognizable.

Example:

```text
30 days → 15 days
```

Treatment:

- previous value: neutral, optionally struck through
- arrow: neutral
- new value: amber and semibold/bold

The actual changed value should carry more visual weight than surrounding policy text.

For version comparison screens, use two clean panels:

```text
ACTIVE VERSION        DRAFT VERSION

30 days               15 days
```

Avoid full-document diff styling unless necessary.

---

## 16. Icons

Use a consistent simple line icon set.

The current design uses Material Symbols Outlined.

Suggested semantics:

```text
Overview        grid_view
Policies        description
Impact Runs     alt_route
Policy clause   policy
Form            dynamic_form / description
Procedure       account_balance / checklist
Software rule   terminal / rule_settings
```

Icons should support comprehension, not decorate empty space.

---

## 17. Interaction behavior

### Selection

Selecting an impact should:

1. highlight the selected list row
2. highlight the corresponding graph path
3. dim unrelated graph elements
4. update the path explanation
5. expose review controls

### Hover

Hover states should be subtle:

- light neutral background
- slightly stronger text or border
- no large movement or dramatic animation

### Toasts

Use small contextual feedback for:

- impact confirmed
- impact dismissed
- impact resolved
- draft saved

Toasts should disappear automatically and not interrupt workflow.

### Animation

Use minimal transitions.

No decorative motion.

---

## 18. Copy style

UI copy should be concise.

Prefer:

```text
3 affected artifacts
2 hops away
Approved dependencies
Run impact analysis
```

Avoid:

```text
This policy mutation has been determined to potentially affect three downstream operational artifacts based on graph traversal.
```

Do not expose technical implementation language unless the screen specifically requires it.

Avoid terms like:

- graph hash
- traversal algorithm
- execution engine
- system health
- live graph state

in normal MVP UI.

---

## 19. Responsive behavior

Desktop is the primary target.

### Desktop

- fixed 200px sidebar
- two-column workspaces where appropriate
- impact screen roughly 36% list / 64% graph

### Narrower screens

- collapse or hide sidebar
- stack graph below the result list
- preserve textual path explanation
- keep review controls accessible

Do not sacrifice clarity to preserve the desktop graph layout.

---

## 20. Accessibility

- Maintain clear text contrast.
- Do not rely on color alone for status or graph meaning.
- Keep interactive targets comfortably clickable.
- Preserve visible focus states.
- Use semantic button and navigation elements.
- Every graph relationship must have a textual equivalent somewhere in the interface.
- Selected states should have more than one cue: background, accent, typography, icon, or label.

---

## 21. Do not introduce

Do not add the following visual patterns unless explicitly requested:

- dark hacker aesthetic
- gradients
- glassmorphism
- huge rounded pills
- floating decorative cards
- fake analytics dashboards
- system telemetry
- graph health metrics
- excessive uppercase micro-labels
- heavy monospace styling
- dense enterprise tables
- nested card stacks
- large modals for simple review actions
- decorative illustrations

---

## 22. Canonical MVP visual example

The current impact-analysis page establishes the reference layout:

```text
┌───────────────┬──────────────────────────────────────────┐
│ Sidebar       │ Impact analysis                          │
│               │ Travel Reimbursement Policy              │
│ Overview      │ 30 days → 15 days        3 affected      │
│ Policies      │                                          │
│ Impact Runs   │ ┌────────────────┬─────────────────────┐ │
│               │ │ Impacted       │ Selected dependency │ │
│               │ │ artifacts      │ path                │ │
│               │ │                │                     │ │
│               │ │ Form           │     Large graph     │ │
│               │ │ Procedure      │                     │ │
│               │ │ Software rule  │                     │ │
│               │ └────────────────┴─────────────────────┘ │
│               │                                          │
│               │        Why is this affected?             │
└───────────────┴──────────────────────────────────────────┘
```

This composition should guide related screens without forcing every page into the exact same structure.

---

## 23. Final design rule

When adding or changing UI, ask:

```text
Does this help the user understand:
1. what changed?
2. what is affected?
3. why is it affected?
4. what action can they take?
```

If the answer is no, the element probably does not belong in the MVP interface.
