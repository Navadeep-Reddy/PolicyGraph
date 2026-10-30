# CareSync policy PDF test pack

These fictional policies test PDF text extraction, OCR transcription, AI clause selection, dependency suggestions, version comparison, and deterministic impact analysis. They contain no patient data.

**For the smaller presentation demo, use [COMPACT_DEMO.md](COMPACT_DEMO.md): three clauses, three seeded operational items, and a visiting-hours change with direct and indirect impacts.**

## Files

| File | Import behavior | Purpose |
|---|---|---|
| `visitor-access-compact-v1.pdf` | Embedded text; one page | Compact baseline with three clauses |
| `visitor-access-compact-v2.pdf` | Embedded text; one page | Compact revision: 8 p.m. → 6 p.m. |
| `hospital-visitor-access-v1-digital.pdf` | Embedded text; Qwen OCR should not be needed | Baseline visitor policy |
| `hospital-visitor-access-v2-digital.pdf` | Embedded text | One-clause visitor-hours revision |
| `oxygen-cylinder-control-v1-scanned.pdf` | Image-only pages; all pages should use Qwen OCR | Baseline Facilities policy |
| `oxygen-cylinder-control-v2-scanned.pdf` | Image-only pages | One-clause stock-threshold revision |

Editable source text is under `source/`. Regenerate all six files with:

```bash
cd server
node scripts/generate-policy-pdfs.mjs
```

## What the AI should treat as clauses

The original visitor and oxygen documents below each contain five expected clauses. The compact pair contains only three; see [COMPACT_DEMO.md](COMPACT_DEMO.md). Exact AI-generated keys, titles, and categories may vary, but the requirement sentences should be preserved rather than paraphrased.

### Visitor access

1. `General visiting hours`: visitors leave by the stated time unless an exception is authorized.
2. `Visitor registration`: Security verifies photo ID and records three fields.
3. `Visitor badges`: visitors wear and return the badge.
4. `Access outside general visiting hours`: admission requires an approved authorization record.
5. `Ward visitor limit`: the nurse in charge limits visitors under the stated operational condition.

### Oxygen cylinder control

1. `Shift-start inventory count`: a designated technician counts full and empty cylinders.
2. `Minimum stock notification`: a threshold triggers notification within a time limit.
3. `Inventory record`: the technician records the listed fields in the Oxygen Inventory Log.
4. `Storage separation`: full and empty cylinders remain in separate labeled racks.
5. `Unresolved shortage escalation`: an unresolved notification triggers escalation and recording.

## What should not become clauses

- Document IDs, versions, owners, approval dates, and review dates.
- Purpose, scope, definitions, and historical background.
- Visitor arrival and cylinder arithmetic examples.
- Statements explicitly described as context, observations, or non-requirements.
- Contact instructions and mailbox availability.

If these appear as extracted clauses, keep them visible during the demonstration and explain that a human reviews AI suggestions before publication. Remove them before publishing so dependency and impact results remain meaningful.

## Operational items and dependency graph

To prepare the database for the PDF presentation, run from `server/`:

```bash
npm run db:demo:pdf
```

This opt-in reset **deletes all CareSync application records** and loads exactly the three items from `compact-operational-items.json`: Security Desk Visitor Procedure, Visitor Information Sheet, and Visitor Access Training Module. It creates no policies, clauses, dependencies, or impact runs. Follow [COMPACT_DEMO.md](COMPACT_DEMO.md) for the matching three-clause PDFs and graph. The reset and inserts run in one transaction. `npm run db:demo` still restores the original visitor-policy demo instead.

Create the items below, ask AI for suggestions, approve only correct suggestions, and add any missing links manually. The names and content deliberately share language with the policy so suggestions have enough evidence.

`operational-items.json` retains complete, copy-ready fields for the original 12 sample items if you want to prepare the larger scenarios manually. The current PDF-demo reset uses the separate three-entry `compact-operational-items.json` instead. Each item entry matches the body of `POST /items`; outer group labels in the original file are not API request bodies.

The edges below define a controlled baseline for the exact expected results. AI may suggest additional valid links. For an exact three-result impact test, approve only the baseline links and leave additional suggestions proposed or rejected. Match clause sources to their actual extracted stable keys; the display titles below are descriptive labels, not predetermined AI keys.

### Visitor access items

| Name | Type | Department | Content summary |
|---|---|---|---|
| Security Desk Visitor Procedure | `PROCEDURE` | Security | Registration, closing-time reminders, and after-hours checks |
| Visitor Registration Form | `FORM` | Security | Visitor name, destination, arrival time, ID verification |
| Inpatient Ward Visitor Checklist | `CHECKLIST` | Nursing Operations | Badge visibility, authorization, and visitor-limit checks |
| Visitor Information Sheet | `INFORMATION_SHEET` | Patient Experience | General visiting hours and badge-return instructions |
| Visitor Access Training Module | `TRAINING_MATERIAL` | Learning and Development | Teaches staff how to follow the Security Desk Visitor Procedure |
| After-Hours Authorization Record | `FORM` | Nursing Operations | Authorized visitor name and nurse approval |

Recommended approved edges:

```text
General visiting hours --GOVERNS--> Security Desk Visitor Procedure
General visiting hours --APPEARS_IN--> Visitor Information Sheet
Security Desk Visitor Procedure --UPDATES--> Visitor Access Training Module
Visitor registration --GOVERNS--> Visitor Registration Form
Visitor badges --GOVERNS--> Inpatient Ward Visitor Checklist
Access outside general visiting hours --GOVERNS--> After-Hours Authorization Record
Ward visitor limit --GOVERNS--> Inpatient Ward Visitor Checklist
```

### Oxygen control items

| Name | Type | Department | Content summary |
|---|---|---|---|
| Oxygen Stock Check Procedure | `PROCEDURE` | Facilities | Shift-start counting steps and shortage response |
| Oxygen Inventory Log | `FORM` | Facilities | Date, time, location, full/empty counts, and technician initials |
| Oxygen Shortage Reporting Checklist | `CHECKLIST` | Facilities | Stock threshold and notification deadline |
| Facilities Shift Handover Instruction | `DEPARTMENT_INSTRUCTION` | Facilities | Communicates open shortage actions to the next shift |
| Medical Gas Storage Training | `TRAINING_MATERIAL` | Learning and Development | Full/empty cylinder separation and labeled-rack practices |
| Supply Chain Escalation Record | `FORM` | Supply Chain | Duty manager escalation time, recipient, and resolution |

Recommended approved edges:

```text
Shift-start inventory count --GOVERNS--> Oxygen Stock Check Procedure
Oxygen Stock Check Procedure --UPDATES--> Oxygen Inventory Log
Inventory record --GOVERNS--> Oxygen Inventory Log
Minimum stock notification --GOVERNS--> Oxygen Shortage Reporting Checklist
Oxygen Shortage Reporting Checklist --UPDATES--> Facilities Shift Handover Instruction
Oxygen Shortage Reporting Checklist --UPDATES--> Supply Chain Escalation Record
Storage separation --GOVERNS--> Medical Gas Storage Training
Unresolved shortage escalation --GOVERNS--> Supply Chain Escalation Record
```

## Revision and expected impact

The current UI imports a PDF for a new policy; revisions accept pasted text or copied clauses. Import the v1 PDF, review the five clauses, publish it, create the items and approved edges, then create a revision. For a controlled comparison, edit only the indicated draft clause. The v2 PDF and its source show the intended replacement wording.

### Visitor revision

Change `8:00 p.m.` to `6:00 p.m.` in `General visiting hours`. The comparison should show one `MODIFIED` policy clause and four `UNCHANGED` clauses.

Expected impacts from the recommended graph:

```text
Distance 1: Security Desk Visitor Procedure
Distance 1: Visitor Information Sheet
Distance 2: Visitor Access Training Module
```

### Oxygen revision

Change the minimum stock trigger from fewer than `12` cylinders within `15` minutes to fewer than `18` cylinders within `10` minutes. The comparison should show one `MODIFIED` policy clause and four `UNCHANGED` clauses.

Expected impacts from the recommended graph:

```text
Distance 1: Oxygen Shortage Reporting Checklist
Distance 2: Facilities Shift Handover Instruction
Distance 2: Supply Chain Escalation Record
```

Only `APPROVED` dependencies should appear in either impact report. Leave one plausible edge as `PROPOSED` during testing to demonstrate that it appears dashed in the dependency graph but is excluded from impact traversal.

## Test procedure and scoring

1. Upload a v1 PDF from **New policy**, using the matching policy title. Test the digital and scanned policies separately.
2. Check the draft against the five expected requirements. Do not assume successful import means accurate extraction.
3. Count true requirements extracted and non-requirements incorrectly extracted. Splitting one requirement into several entries should not count as multiple true positives. Check exact numbers, times, conditions, responsible roles, and exceptions.
4. For these original five-clause scenarios, create the six matching items manually before reviewing dependency suggestions; the current PDF-demo reset supplies only the three compact-demo items. Save the baseline links above as approved, adding missing links manually. For the compact workflow, follow COMPACT_DEMO.md instead.
5. Create a revision by copying the active version. Edit only the specified clause, keeping its existing stable key. Compare before publishing the revision and run impact analysis while it is a draft.
6. Confirm one modified clause, four unchanged clauses, the three expected impact results, distances, and full paths. Items with no approved path from the changed clause must not appear.
7. Confirm or resolve one result, refresh, and verify the saved status.

Useful extraction metrics:

- Requirement recall: expected requirements correctly represented / 5.
- Requirement precision: true extracted requirement entries / all extracted entries, after accounting for split clauses.
- Wording fidelity: no changed threshold, deadline, exception, or invented requirement.

For a fair clause-selection test, do not supply this answer key to the model. The source documents intentionally label requirements and explanatory sections, making this an initial, unambiguous test rather than an adversarial benchmark.

### Revision re-extraction test

To separately test stable-key reuse by the LLM, paste the readable text from the v2 source into **Create revision** instead of copying and editing. Remove Markdown heading markers and the `PAGE BREAK` comments first. Check the returned keys against the v1 keys and inspect unchanged text carefully. The model may split, merge, or reformat clauses; the controlled copy-and-edit path above is the reliable way to isolate deterministic comparison and BFS behavior.

Do not upload the v2 PDF as another new policy and expect a comparison: a PDF upload creates a separate policy, not a revision of the existing policy.

## Validation scope

All PDFs are three pages and below the 15 MiB / 100-page import limits. The digital pair contains embedded text; the scanned pair contains zero embedded text and is designed to trigger page OCR. The scanned versions are synthetic image-only documents, not photographs of paper, so they test the OCR route without adding severe skew, blur, handwriting, or poor lighting.

The answer key describes expected AI behavior, not a guarantee for every model run. Generating the PDFs does not modify the database; the optional `db:demo:pdf` command explicitly resets it. API contracts are unchanged.

The clause-extraction prompt now explicitly selects operative rules and excludes descriptive purpose, scope, definitions, metadata, history, contacts, and examples. Real NVIDIA-provider regression checks passed on both digital visitor PDFs and both oxygen source texts: exactly five requirements per input, no missing or unexpected text, and stable-key reuse across revisions. The oxygen checks validate clause selection from text, not Qwen OCR. Re-run these opt-in provider checks from `server/` (uses the configured NVIDIA service; writes no database records):

```bash
npx tsx scripts/check-policy-extraction.ts
```

Checks performed when creating this pack:

- Opened and inspected all four PDFs with PDF.js: three pages each, valid embedded text in the digital pair, zero embedded text in the scanned pair, all well below 15 MiB.
- Ran the visitor v1 PDF through `PdfDocumentService`: three pages, meaningful text recovered, and zero OCR calls.
- Visually inspected all three rendered pages of the scanned oxygen v1 PDF with the document reader.
- Validated all 12 operational-item JSON entries and the generator's JavaScript syntax.
- Backend lint, 131 tests, and build passed.

A separate standalone PDF.js rasterization attempt timed out in this environment. Full scanned import through the application's rasterizer and real Qwen service remains unverified.
