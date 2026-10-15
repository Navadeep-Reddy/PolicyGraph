# CareSync — Visual & UI Design System Specification

This document defines CareSync's visual and UI design rules: colours, typography, materials, spacing, layout, component styling, responsive presentation, accessibility, and motion. It does not define product features, workflows, business rules, validation logic, or data lifecycles.

All screens must follow these rules. Do not introduce unlisted colours, radii, shadows, type styles, or component variants.

---

## 1. Design Principles

1. **Clinical minimalism.** Use generous whitespace, pale blue-white surfaces, and 1px low-opacity borders. Avoid large colour blocks except for one optional dark navy emphasis panel on a page.
2. **One accent colour.** Use desaturated steel blue for interaction, icons, active states, links, numerals, and progress. Green is allowed only for tiny positive or live indicators.
3. **One typeface family.** Use Plus Jakarta Sans in weights 200–700. Use monospace only for IDs, codes, revisions, hashes, status chips, timestamps, and technical values.
4. **Frosted-glass surfaces.** Cards are 60–90% opaque white with backdrop blur, a 1px accent-tinted border, and a soft neutral shadow.
5. **Technical micro-labels.** Navigation, buttons, eyebrows, badges, and table headers use uppercase text with wide letter-spacing.
6. **No decorative imagery.** Do not use photography, illustrations, emoji, or filled multicolour icons. Visual interest comes from hairline grids, thin outline icons, tables, typography, and restrained data details.
7. **Restrained motion.** Use only small hover lifts, soft dot pulses, arrow nudges, and colour transitions. Nothing bouncy, flashy, or gamified.
8. **Dark primary actions.** Primary buttons use dark ink with white text and shift to the steel-blue accent on hover.
9. **Clear visual states.** Distinguish proposed, confirmed, historical, and active states through labels, icons, and border treatments.

---

## 2. Colour System

### 2.1 Core palette

| Token | Hex | Role |
|---|---|---|
| `ink` | `#06101E` | Primary text, headings, dark buttons, active pills, and dark emphasis panels. This is the darkest colour; never use `#000000`. |
| `accent` | `#36637C` | Eyebrows, icons, links, numerals, progress, tinted borders, focus, and button hover. |
| `text-secondary` | `#45474C` | Body text and descriptions. |
| `text-muted` | `#75777D` | Micro-labels, table headers, metadata, footnotes, and inactive tabs. |
| `bg-base` | `#F5FAFF` | Page background at the top of the application. |
| `surface-white` | `#FFFFFF` | Glass surfaces, cards, fields, drawers, and menus. |
| `surface-1` | `#EAF5FF` | Inner panels, stat tiles, and quiet grouped regions. |
| `surface-2` | `#DEF0FF` | Chips, badges, selected rows, and hover backgrounds. |
| `surface-3` | `#D2ECFF` | Secondary data accents and avatar initials. |
| `surface-4` | `#C9E6FC` | Progress tracks and stronger dividers. |
| `selection-bg` | `#B6E3FF` | Selected text background. |
| `selection-fg` | `#001E2C` | Selected text foreground. |
| `accent-light` | `#C3E7FF` | Accent text and dots on dark panels. |
| `on-dark-muted` | `#7A8496` | Secondary text on dark panels. |
| `on-dark` | `#FFFFFF` | Primary text on dark panels. |

### 2.2 Exact gradients

| Name | Definition |
|---|---|
| Application background | Linear, top to bottom: `#F5FAFF 0% → #EAF5FF 50% → #DDEEF8 100%` |
| Diagram or graph canvas | Linear, top to bottom: `#F0F7FC → #E4F1FB` |
| Ambient glow A | `135deg`: `#C9E6FC` at 40% opacity → `#DEF0FF` at 30% opacity → transparent; blur `64px`; element opacity `0.6` |
| Ambient glow B | `45deg`: `#B6E3FF` at 30% opacity → `#C9E6FC` at 20% opacity → transparent; blur `64px`; element opacity `0.5` |

The root application background must use the application gradient. Ambient glows may be placed behind major panels but must never reduce text contrast.

### 2.3 Status colours

The reference style intentionally avoids multiple semantic hues. State must therefore be communicated through text, outline icons, border treatment, and shape—not colour alone.

| Use | Value |
|---|---|
| Live/positive dot | `#10B981` |
| Positive chip | bg `#ECFDF5`, text `#047857`, border `#A7F3D0` |
| Positive micro-text | `#059669` |
| Draft/neutral | `surface-1` background, `text-muted` text, `border-default` |
| Needs review | `surface-2` background, `accent` text, `border-strong` |
| Blocked/failed | white background, `ink` text, `2px ink` left rule, blocked icon |
| AI proposed | `surface-2` background, `accent` text, dashed `border-strong` |
| Superseded/history | transparent background, `text-muted` text, lock/history icon |

Do not introduce red, orange, purple, or gold. A blocked state must explicitly say `BLOCKED` and include a blocked icon.

### 2.4 Alpha recipes

| Token | Value |
|---|---|
| `border-faint` | `rgba(54,99,124,0.10)` |
| `border-default` | `rgba(54,99,124,0.15)` |
| `border-strong` | `rgba(54,99,124,0.20)` |
| `accent-wash` | `rgba(54,99,124,0.10)` |
| `grid-line` | `rgba(54,99,124,0.08)` |
| `nav-text` | `rgba(6,16,30,0.75)` |
| `glass-90` | `rgba(255,255,255,0.90)` |
| `glass-85` | `rgba(255,255,255,0.85)` |
| `glass-80` | `rgba(255,255,255,0.80)` |
| `glass-70` | `rgba(255,255,255,0.70)` |
| `glass-60` | `rgba(255,255,255,0.60)` |
| `panel-low-70` | `rgba(234,245,255,0.70)` |
| `panel-low-40` | `rgba(234,245,255,0.40)` |
| `row-hover` | `rgba(234,245,255,0.50)` |

Never use gradients on text, buttons, borders, badges, or icons.

---

## 3. Typography

### 3.1 Families

- **Primary:** Plus Jakarta Sans.
- **Fallback:** Manrope, Inter, `system-ui`, sans-serif.
- **Weights:** 200, 300, 400, 500, 600, and 700 only.
- **Monospace:** `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.
- **Icons:** Material Symbols Outlined or an equivalent thin outline set.

### 3.2 Type scale

| Style | Size / line-height | Tracking | Weight | Use |
|---|---|---|---|---|
| `page-title` | `36 / 44px` | `-0.02em` | 300 | Main page heading |
| `section-title` | `28 / 36px` | `-0.02em` | 400 | Major section heading |
| `card-title` | `22 / 30px` | `-0.01em` | 600 | Card and panel heading |
| `item-title` | `18 / 26px` | `0` | 600 | List and record title |
| `body-lg` | `16 / 26px` | `0` | 400 | Lead or important description |
| `body-md` | `14 / 22px` | `0.01em` | 400 | Default body text |
| `body-sm` | `12 / 18px` | `0.01em` | 400 | Captions and supporting text |
| `label-md` | `11 / 16px` | `0.14em` | 600 | Buttons, navigation, table headers |
| `label-sm` | `10 / 14px` | `0.18em` | 600 | Eyebrows, badges, status chips |
| `micro-mono` | `10–12px` | `0.05em` | 400–600 | IDs, hashes, versions, timestamps |

### 3.3 Typography rules

- Page titles use weight `300`; key words may use weight `400`.
- The quiet second line or contextual suffix may use weight `200` and `accent`.
- Navigation, buttons, eyebrows, badges, table headers, and compact status labels are uppercase with wide tracking.
- Headings and body text use sentence case.
- Technical identifiers use uppercase monospace with `//` or `·` separators where useful.
- Numbers in tables and metrics use tabular numerals.
- Body copy should not exceed `72ch`.

---

## 4. Spacing, Layout, and Shape

### 4.1 Spacing tokens

| Token | Value |
|---|---:|
| `xs` | `4px` |
| `sm` | `8px` |
| `md` | `16px` |
| `lg` | `28px` |
| `xl` | `48px` |
| `gutter` | `24px` |
| `gutter-desktop` | `40px` |

Page margins: `20px` mobile, `40px` tablet, `64px` desktop. Maximum content width is `1440px`.

Use `24px` gaps between major cards, `28px` padding in large cards, `16px` padding in medium panels, and `8–10px` padding in technical tiles.

### 4.2 Breakpoints

Mobile-first breakpoints: `640px`, `768px`, and `1024px`.

- Below `768px`: single-column content and off-canvas navigation.
- From `768px`: multi-column tables/cards where readable.
- From `1024px`: permanent application sidebar and split review layouts.

### 4.3 Radius scale

| Element | Radius |
|---|---:|
| Large panels, drawers, modals, dark emphasis panel | `16px` |
| Standard cards and graph canvas | `8px` |
| Inner panels, inputs, tiles, and large buttons | `4px` |
| Small primary buttons | `6px` |
| Chips, badges, nav pills, progress tracks | `12px` |
| Technical chips and compact tabs | `2px` |
| Dots and avatars | `50%` |

Do not use fully rounded pill buttons. Full circles are reserved for dots and avatars.

### 4.4 Borders

- All standard borders are `1px` and accent-tinted.
- Cards use `border-default`; major glass panels use `border-strong`.
- Nested panels and table rows use `border-faint`.
- Blocked notices may use a `2px ink` left rule while retaining a `1px border-default` outer border.

### 4.5 Shadows and blur

| Level | Value |
|---|---|
| `shadow-xs` | `0 1px 2px rgba(0,0,0,0.05)` |
| `shadow-sm` | `0 1px 3px rgba(0,0,0,0.10), 0 1px 2px -1px rgba(0,0,0,0.10)` |
| `shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -2px rgba(0,0,0,0.10)` |
| `shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.10), 0 4px 6px -4px rgba(0,0,0,0.10)` |
| `shadow-xl` | `0 20px 25px -5px rgba(0,0,0,0.10), 0 8px 10px -6px rgba(0,0,0,0.10)` |

Use `shadow-sm` on resting cards, `shadow-lg` on data panels, and `shadow-xl` on drawers/modals. Glass blur is `12px` on cards, `16px` on data panels, and `24px` on large feature panels.

---

## 5. Application Shell and Navigation

Use the following visual specifications for the application shell.

### 5.1 Sidebar

- Width: `248px`; collapsed width: `72px`.
- Surface: `glass-70`, blur `16px`, `1px border-default` on the right.
- Brand row: 24px outline logo, uppercase wordmark, `0.24em` tracking.
- Navigation labels: `label-md`, uppercase, `nav-text`.
- Active item: `accent-wash` background, `accent` text, radius `6px`, and a `2px accent` left marker.
- Hover: `surface-2` background and ink text.
- Context text beneath the wordmark uses `micro-mono`.

### 5.2 Top bar

- Height: `64px`; sticky inside the main workspace.
- Surface: `glass-60`, blur `12px`, `1px border-faint` bottom edge.
- Breadcrumbs use uppercase micro-labels for ancestors and sentence case for the current record.
- Do not use a heavy filled header bar.

### 5.3 Page structure

Use this order:

1. breadcrumb and technical context;
2. page title, short description, and one primary action;
3. blocking notice when present;
4. status or metric strip;
5. filters/tabs;
6. main content;
7. pagination or supporting footer.

Use at most one dark emphasis panel per page, reserved for the highest-priority visual emphasis.

---

## 6. Components

### 6.1 Buttons

| Variant | Specification |
|---|---|
| Primary | Height `44px`, padding `0 28px`, radius `6px`, ink background, white `label-md` uppercase text, `shadow-sm`; hover background becomes accent |
| Secondary glass | Height `44px`, padding `0 24px`, radius `6px`, `glass-80`, blur `12px`, ink text, `1px border-default`; hover uses `surface-2` |
| Compact | Height `36px`, padding `0 20px`, radius `2px`, ink background, white uppercase 10px text; hover accent |
| On dark | Height `48px`, padding `0 32px`, radius `4px`, white background, ink text; hover `surface-2` |
| Ghost on dark | Height `48px`, padding `0 24px`, radius `4px`, white at 10% opacity with matching border |

Buttons never use gradients, accent outlines, or fully rounded pill shapes. There must be only one primary button per visual region.

### 6.2 Fields

- Height `44px`; radius `4px`; white background; `1px border-default`; `shadow-xs`.
- Labels use `label-sm`, uppercase, `text-muted`.
- Focus uses a `1px ink` ring plus the existing border.
- Helper text uses `body-sm`; errors use ink text, an alert icon, and explicit correction text.
- Do not depend on red for validation.

### 6.3 Cards and panels

- Standard card: `glass-80`, blur `12px`, `1px border-default`, radius `8px`, `shadow-sm`, padding `28px`.
- Major data panel: `glass-90`, blur `16px`, `1px border-strong`, radius `16px`, `shadow-lg`.
- Inner tile: `surface-1`, `1px border-faint`, radius `4px`, padding `8–16px`.
- Interactive cards may lift `-4px` and use `shadow-xl` on hover. Static operational cards do not lift.

### 6.4 Tables

- Place tables inside a `glass-90` major data panel.
- Header cells: `label-md`, uppercase, `text-muted`, padding `12px 16px`, `1px border-strong` below.
- Body cells: `12–14px`, padding `16px`, with `border-faint` row separators.
- Row hover uses `row-hover`.
- Names use semibold primary text; IDs and revisions appear below in `micro-mono`.
- Numeric and technical columns use monospace and tabular numerals.
- Wide tables scroll inside their container; the page itself never scrolls horizontally.

### 6.5 Badges and status chips

- Padding `4px 12px`; radius `12px`; `label-sm`; uppercase.
- Neutral: `surface-1` and `text-muted`.
- Active/selected: ink background and white text.
- AI proposed: `surface-2`, accent text, dashed border.
- Positive: use the positive chip tokens from §2.3.
- Blocked: white, ink text, solid ink blocked icon, and `border-strong`.

Every chip must contain text; never use colour-only status dots.

### 6.6 Tabs and filters

- Tabs use compact uppercase monospace or `label-sm` text.
- Active tab: `accent-wash`, accent text, radius `2px`.
- Inactive tab: transparent, `text-muted`; hover uses `surface-2`.
- Filter pills use radius `12px`. Active filters use ink background and white text; inactive filters use white with `border-default`.

### 6.7 Drawers and modals

- Surface: `glass-90`, blur `24px`, `1px border-strong`, radius `16px`, `shadow-xl`.
- Trap focus and restore it to the trigger on close.

### 6.8 Notices

- Informational notice: `panel-low-70`, `border-default`, radius `8px`.
- Blocking notice: white, `border-strong`, radius `8px`, `2px ink` left rule, blocked icon, uppercase `BLOCKED` eyebrow.
- Success notice: positive chip colours only in the icon/label; keep the body neutral.

### 6.9 Dark emphasis panel

- Maximum one per page.
- Background `ink`, text white, radius `16px`, padding `28–48px`, `shadow-xl`.
- Use `accent-light` for eyebrow text and dots; `on-dark-muted` for descriptions.
- Add only the two reference-style blurred glows: accent at 30% top-right and `#C9E6FC` at 10% bottom-left, both `384px` circles blurred `64px`.

---

## 7. Content Presentation Patterns

### 7.1 Quotes and technical metadata

- Source quotes use a white panel, `border-default`, radius `4px`, and a `2px accent` left rule.
- Highlight matched text using `selection-bg` with `selection-fg`.
- Version identifiers and technical offsets, when present, use `micro-mono`.

### 7.2 Diffs

- Change-summary labels use uppercase monospace with `//` and `→` separators where useful.
- Use `surface-2` plus an add icon for additions.
- Use white with strike-through and an explicit remove icon for removals.
- Do not introduce green/red diff fills.
- Use side-by-side view on wide screens and unified view below `768px`.

### 7.3 Graph styling

- Confirmed edges use solid accent lines.
- Suggested edges use dashed accent lines at reduced opacity.
- Secondary edge variants use dotted muted lines with explicit text labels.
- Selected paths use full opacity; unrelated nodes fade to 35%.
- Graph background uses the exact diagram gradient and a 24px hairline grid using `grid-line`.
- Every graph must have an equivalent accessible table.

### 7.4 Versions and history

- Locked-version styling pairs an outline lock icon with an uppercase micro-label.
- Active-state styling uses the positive indicator tokens.
- Superseded and historical records remain fully readable; use muted labels rather than reducing the entire card opacity.

### 7.5 Blocking-state presentation

- Blocking-state panels use the blocking notice style with an uppercase heading.
- Notice detail rows use outline icons; technical references use `micro-mono`, and links use `accent`.

---

## 8. Visual Interaction and Motion

| Effect | Specification |
|---|---|
| Card hover | `translateY(-4px)` and `shadow-xl`, `300ms` |
| Button hover | Background colour only, `200ms` |
| Link arrow | `translateX(4px)` on parent hover |
| Nav underline/marker | `150–200ms` |
| Live dot | Soft opacity/scale pulse, approximately `2s` |
| Graph node pulse | Opacity `0.4 → 0.9 → 0.4`, `3s ease-in-out` |

Rules:

- Animate only opacity, colour, and small transforms.
- Never use parallax, spring/bounce easing, scroll-triggered fades, or large movement.
- Honour `prefers-reduced-motion` by disabling nonessential motion.

---

## 9. Responsive Layout

- Stack major columns below `768px`; split evidence/review layouts stack below `1024px`.
- Sidebar becomes an off-canvas drawer below `1024px`.
- Page margins step from `20px` to `40px` to `64px`.
- Page titles scale from `30px` on mobile to `36px` on desktop.
- Buttons become full-width on mobile only when inside forms or action cards.
- Tables scroll within their own panels.
- Drawers become full-screen sheets below `640px`.
- Tabs and filter pills scroll horizontally rather than wrapping into multiple irregular rows.

---

## 10. Accessibility and Content

- Target WCAG 2.2 AA.
- Text must meet `4.5:1` contrast; large text and component boundaries must meet `3:1`.
- Keyboard focus must always be visible using an ink focus ring.
- State must never depend only on colour.
- All icons require accessible names when interactive.
- Dialogs trap focus and restore it when closed.
- Graphs, charts, and diffs require text/table equivalents.
- The interface must remain usable at 200% zoom.
- Use calm, direct, technical language. Avoid playful copy such as “Oops”.
- Dates use an unambiguous format such as `15 OCT 2026 · 03:30 PM IST`.
- Error copy uses calm, direct language; any technical identifiers use `micro-mono`.

---

## 11. Hard Rules

### Do

- Use only the palette, alphas, radii, shadows, blur values, and type styles defined here.
- Use Plus Jakarta Sans and monospace only for technical data.
- Give every card a 1px accent-tinted border.
- Use uppercase, tracked micro-labels for navigation, buttons, badges, and table headers.
- Use dark ink buttons with accent hover.
- Keep exactly one accent colour and at most one dark emphasis panel per page.
- Pair state styling with explicit text labels and outline icons.

### Never

- Add red, orange, purple, gold, or another accent hue.
- Use pure black, heavy grey backgrounds, or saturated colour blocks.
- Add photos, stock imagery, illustrations, emoji, or filled multicolour icons.
- Use weights above 700.
- Use fully rounded primary buttons or oversized 20–24px card radii.
- Add gradients to buttons, text, icons, or borders.
- Make blocking-state notices visually subordinate to secondary content.

This document is the canonical CareSync visual contract. Page-specific designs may compose these patterns but must not override them locally.
