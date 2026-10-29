# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Hospital staff who need to determine which operational items may need review after a policy changes.

## Product Purpose

CareSync helps hospital staff identify procedures and other operational items that may be affected when a policy clause changes. Success means users can inspect each potential impact together with its complete dependency path and decide whether the item truly needs attention.

## Positioning

CareSync combines AI-proposed clauses and dependencies, human review of those proposals, and deterministic dependency-path analysis to explain potential operational impact. It does not guarantee compliance.

## Operating Context

Users enter policy text, review extracted clauses, maintain operational items and their dependencies, compare policy versions, and inspect impact paths after a revision. The application starts empty; users provide its policies, items, and dependencies.

## Capabilities and Constraints

- AI proposes policy clauses and dependencies and performs literal transcription only for OCR-needed pages of imported PDFs. People review and edit clauses and decide whether suggested dependencies are accepted.
- Change detection, impact traversal, explanations, and persistence are deterministic.
- Impact analysis follows approved dependencies and provides a complete path for each result.
- The product handles hospital operations and policy only. It does not handle patient data, diagnosis, or treatment.
- There is no authentication. Hospital-system integrations, OCR beyond PDF page transcription, DOCX extraction, notifications, and report export are out of scope.
- The client is React, TypeScript, Vite, and Tailwind CSS. The server is NestJS, TypeScript, and Prisma, backed by hosted Supabase PostgreSQL.

## Brand Commitments

The product name is CareSync. Use calm, direct, technical language.

## Evidence on Hand

The repository contains the product specification, API contract, build plan, and application implementation. There are no confirmed customer testimonials, benchmarks, or case studies; do not fabricate them. The application starts with no policy or dependency demo data.

## Product Principles

- Keep people responsible for deciding whether a potential impact is real.
- Make every impact explainable through its dependency path.
- Keep change detection and impact analysis deterministic.
- Limit the product to hospital operational policy; do not introduce patient data or clinical workflows.
