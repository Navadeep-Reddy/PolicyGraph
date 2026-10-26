---
name: CareSync
description: Transit wayfinding for hospital policy operations
colors:
  midnight-ink: "#16233F"
  scarlet-route: "#BF4D52"
  cobalt-route: "#356DB2"
  amber-route: "#B78118"
  green-route: "#43805A"
  porcelain: "#FFFFFF"
  warm-ground: "#F7F5EE"
  muted-text: "#647084"
  secondary-text: "#39465C"
  quiet-surface: "#EEF0ED"
  selected-surface: "#E7EBF1"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "clamp(30px, 3vw, 38px)"
    fontWeight: 500
    lineHeight: 1.16
    letterSpacing: "-0.035em"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "0.11em"
  technical:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  sm: "3px"
  md: "4px"
  lg: "6px"
  panel: "10px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "28px"
  page-mobile: "20px"
  page-tablet: "40px"
  page-desktop: "64px"
components:
  button-primary:
    backgroundColor: "{colors.midnight-ink}"
    textColor: "{colors.porcelain}"
    rounded: "{rounded.md}"
    padding: "0 28px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.scarlet-route}"
  input:
    backgroundColor: "{colors.porcelain}"
    textColor: "{colors.midnight-ink}"
    rounded: "{rounded.sm}"
    height: "44px"
  navigation:
    backgroundColor: "{colors.midnight-ink}"
    textColor: "{colors.porcelain}"
    width: "248px"
---

# Design System: CareSync

## Overview

**Creative North Star: “The Policy Transit Map”**

CareSync borrows the disciplined linework of metropolitan wayfinding to make its real differentiator visible: a policy change can be followed through approved relationships to the operational items connected to it. The overall product remains a familiar web application with a readable policy register, standard controls, and explicit human review actions. Route notation appears in dependency and impact views where it helps explain the work.

The atmosphere is precise, composed, and operational. A midnight navigation rail frames a warm porcelain workspace; route inks mark relationships and current state. Names and labels remain primary, and every graph has a textual counterpart.

**Key Characteristics:**
- Midnight-blue navigation with a warm, quiet work surface.
- Crisp table alignment and explicit active/draft policy states.
- Right-angle relationship routes with labeled station nodes.
- Route color always paired with text, line style, and accessible path details.

## Colors

The palette pairs a midnight shell and warm porcelain work area with four restrained route inks.

### Primary
- **Midnight Ink** (`#16233F`): Navigation, primary actions, and primary text.
- **Scarlet Route** (`#BF4D52`): Selected route, focus, and emphasis; also the `GOVERNS` relationship.

### Secondary
- **Cobalt Route** (`#356DB2`): `UPDATES` dependencies and operational-item nodes.
- **Amber Route** (`#B78118`): `APPEARS_IN` dependencies and policy-clause nodes.
- **Green Route** (`#43805A`): Published/active state indicators paired with written labels.

### Neutral
- **Warm Ground** (`#F7F5EE`): Application and reading canvas.
- **Porcelain** (`#FFFFFF`): Tables, forms, and content panels.
- **Quiet Surface** (`#EEF0ED`): Grouped content and subtle structure.
- **Selected Surface** (`#E7EBF1`): Hover and selected backgrounds.
- **Secondary Text** (`#39465C`): Body copy.
- **Muted Text** (`#647084`): Metadata and supporting labels.

**The Named Route Rule.** Color never carries relationship meaning alone. Every route has a text label and an accessible text equivalent.

## Typography

**Display Font:** system humanist sans (`ui-sans-serif`, `system-ui`, platform sans-serif)

**Body Font:** the same system sans stack

**Label/Mono Font:** system monospace for stable keys, dates, IDs, and technical values

**Character:** Direct and legible with a compact hierarchy. The interface uses system fonts for dependable rendering and keeps monospace to actual identifiers and measurements.

### Hierarchy
- **Display** (500, 30–38px, 1.16): Page titles.
- **Headline** (500, 25px, 1.3): Major section headings.
- **Title** (600, 17–20px, 1.35–1.45): Panels and records.
- **Body** (400, 14–16px, 1.6–1.65): Instructions, descriptions, and evidence.
- **Label** (700, 10–11px, tracked uppercase): Navigation, status headings, and compact table headings.
- **Technical** (500, 10px monospace): Stable clause keys, IDs, dates, and counts.

## Layout

The desktop shell uses a persistent 248px midnight navigation rail and a warm workspace with a maximum width of 1440px. Workspace margins are 20px on mobile, 40px on tablet, and 64px on desktop. Policy status is presented in aligned table columns; the first dashboard read is the actual policy list, not a decorative metric. Graphs use a quiet 24px alignment grid only on the graph canvas. On smaller screens, the sidebar becomes an accessible off-canvas dialog, major columns stack, and wide tables scroll inside their own boundaries.

## Elevation & Depth

Depth is structural rather than atmospheric. White data panels sit slightly above the warm page ground with a fine ink-tinted border and a restrained offset shadow (`0 8px 22px rgba(22,35,63,0.12)`). Avoid frosted glass and decorative blur. Interactive states use color and boundary changes rather than lift.

## Shapes

Use compact, lightly rounded geometry: 3px input corners, 4px control corners, 6px cards, and 10px large panels. Route nodes are circles; route turns are square and disciplined. Standard panel borders are 1px, tinted from midnight ink. Primary buttons are not pill-shaped.

## Components

### Buttons
- **Shape:** Compact, gently rounded corners (4px).
- **Primary:** Midnight ink with white uppercase label, 44px high and 28px horizontal padding.
- **Hover / Focus:** Primary action shifts to scarlet; keyboard focus uses a visible 2px scarlet outline.
- **Secondary:** White surface, 1px ink-tinted border, dark text.

### Chips
- **Style:** Small, explicit text label on a quiet neutral background with a fine boundary.
- **State:** Proposed dependencies use a dashed border; approved, active, historical, and review states retain explicit words.

### Cards / Containers
- **Corner Style:** 6px standard panels; 10px major data regions.
- **Background:** Porcelain over the warm ground.
- **Shadow Strategy:** Restrained offset shadow on major panels only.
- **Border:** Fine midnight-tinted boundary.
- **Internal Padding:** 16–28px according to panel scale.

### Inputs / Fields
- **Style:** White background, 1px boundary, 3px radius, 44px control height.
- **Focus:** Visible 2px scarlet outline with offset.
- **Error / Disabled:** Direct explanatory text; disabled controls retain legible labels.

### Navigation
- **Style:** Persistent midnight rail on desktop with white labels and a quiet active background. A short scarlet station marker identifies the active route. On mobile, use a full-height accessible navigation dialog.

### Dependency Route
Use right-angle paths, labeled relationships, and station-like nodes. `GOVERNS` is scarlet, `UPDATES` cobalt, and `APPEARS_IN` amber. Approved edges are solid; proposed edges are dashed. The impact selection is emphasized while context remains visible. A text table and ordered path carry all graph content without requiring visual interpretation.

## Do's and Don'ts

### Do:
- **Do** make policy names, active versions, and draft states the first dashboard read.
- **Do** pair every relationship route with a visible label and text equivalent.
- **Do** keep navigation and controls familiar to web users.
- **Do** use explicit state labels and preserve keyboard focus visibility.
- **Do** use route colors consistently for relationship types across graph and path views.

### Don't:
- **Don't** imply geographic distance, live transit status, or travel time; the route is a dependency metaphor only.
- **Don't** rely on color alone to communicate status or relationship.
- **Don't** use decorative route graphics on pages without route data.
- **Don't** use patient data, clinical recommendations, or fabricated policy records as interface content.
