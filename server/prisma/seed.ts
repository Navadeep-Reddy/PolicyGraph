// Canonical Travel Reimbursement seed for the PolicyGraph one-day MVP.
//
// Idempotent: every row uses a fixed id and is written with upsert, so the
// script can be rerun safely at any time:
//   npm run db:seed
//
// Graph (all edges APPROVED, upstream source -> downstream consumer):
//   Clause --IMPLEMENTED_BY--> Travel Claim Form
//   Clause --REFERENCED_BY--> Finance Reimbursement Procedure
//   Travel Claim Form --CONSUMED_BY--> Backend Deadline Validation Rule
import "dotenv/config";
import { createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient({
  // Prisma 7 connects through a driver adapter; the datasource URL in
  // prisma7.config.ts only applies to migrations.
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

const ORGANIZATION_ID = "org-demo";

const ACTIVE_CLAUSE_TEXT =
  "Employees must submit travel reimbursement claims within 30 days of travel completion.";
const DRAFT_CLAUSE_TEXT =
  "Employees must submit travel reimbursement claims within 15 days of travel completion.";

function textHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function main(): Promise<void> {
  await prisma.policy.upsert({
    where: { id: "policy-travel-reimbursement" },
    update: {
      title: "Travel Reimbursement Policy",
      description:
        "Rules for claiming reimbursement of business travel expenses.",
    },
    create: {
      id: "policy-travel-reimbursement",
      organizationId: ORGANIZATION_ID,
      title: "Travel Reimbursement Policy",
      description:
        "Rules for claiming reimbursement of business travel expenses.",
    },
  });

  await prisma.policyVersion.upsert({
    where: { id: "version-travel-active" },
    update: { versionNumber: 1, status: "ACTIVE" },
    create: {
      id: "version-travel-active",
      policyId: "policy-travel-reimbursement",
      versionNumber: 1,
      status: "ACTIVE",
    },
  });

  await prisma.policyVersion.upsert({
    where: { id: "version-travel-draft" },
    update: { versionNumber: 2, status: "DRAFT" },
    create: {
      id: "version-travel-draft",
      policyId: "policy-travel-reimbursement",
      versionNumber: 2,
      status: "DRAFT",
    },
  });

  await prisma.clause.upsert({
    where: {
      policyVersionId_stableKey: {
        policyVersionId: "version-travel-active",
        stableKey: "TRAVEL-CLAIM-DEADLINE",
      },
    },
    update: {
      id: "clause-travel-deadline-active",
      text: ACTIVE_CLAUSE_TEXT,
      position: 1,
      textHash: textHash(ACTIVE_CLAUSE_TEXT),
    },
    create: {
      id: "clause-travel-deadline-active",
      policyVersionId: "version-travel-active",
      stableKey: "TRAVEL-CLAIM-DEADLINE",
      text: ACTIVE_CLAUSE_TEXT,
      position: 1,
      textHash: textHash(ACTIVE_CLAUSE_TEXT),
    },
  });

  await prisma.clause.upsert({
    where: {
      policyVersionId_stableKey: {
        policyVersionId: "version-travel-draft",
        stableKey: "TRAVEL-CLAIM-DEADLINE",
      },
    },
    update: {
      id: "clause-travel-deadline-draft",
      text: DRAFT_CLAUSE_TEXT,
      position: 1,
      textHash: textHash(DRAFT_CLAUSE_TEXT),
    },
    create: {
      id: "clause-travel-deadline-draft",
      policyVersionId: "version-travel-draft",
      stableKey: "TRAVEL-CLAIM-DEADLINE",
      text: DRAFT_CLAUSE_TEXT,
      position: 1,
      textHash: textHash(DRAFT_CLAUSE_TEXT),
    },
  });

  await prisma.artifact.upsert({
    where: { id: "artifact-travel-claim-form" },
    update: { name: "Travel Claim Form", type: "FORM", criticality: 4 },
    create: {
      id: "artifact-travel-claim-form",
      organizationId: ORGANIZATION_ID,
      name: "Travel Claim Form",
      type: "FORM",
      description: "Form employees fill in to claim travel expenses.",
      criticality: 4,
    },
  });

  await prisma.artifact.upsert({
    where: { id: "artifact-finance-procedure" },
    update: {
      name: "Finance Reimbursement Procedure",
      type: "PROCEDURE",
      criticality: 3,
    },
    create: {
      id: "artifact-finance-procedure",
      organizationId: ORGANIZATION_ID,
      name: "Finance Reimbursement Procedure",
      type: "PROCEDURE",
      description: "Finance team procedure for reviewing reimbursement claims.",
      criticality: 3,
    },
  });

  await prisma.artifact.upsert({
    where: { id: "artifact-deadline-rule" },
    update: {
      name: "Backend Deadline Validation Rule",
      type: "SOFTWARE_RULE",
      criticality: 5,
    },
    create: {
      id: "artifact-deadline-rule",
      organizationId: ORGANIZATION_ID,
      name: "Backend Deadline Validation Rule",
      type: "SOFTWARE_RULE",
      description: "Backend rule rejecting claims submitted after the deadline.",
      criticality: 5,
    },
  });

  await prisma.dependencyEdge.upsert({
    where: { id: "edge-clause-form" },
    update: { status: "APPROVED" },
    create: {
      id: "edge-clause-form",
      organizationId: ORGANIZATION_ID,
      sourceNodeId: "clause-travel-deadline-active",
      sourceNodeType: "CLAUSE",
      targetNodeId: "artifact-travel-claim-form",
      targetNodeType: "ARTIFACT",
      relationshipType: "IMPLEMENTED_BY",
      status: "APPROVED",
      rationale: "The claim form implements the submission deadline clause.",
    },
  });

  await prisma.dependencyEdge.upsert({
    where: { id: "edge-clause-procedure" },
    update: { status: "APPROVED" },
    create: {
      id: "edge-clause-procedure",
      organizationId: ORGANIZATION_ID,
      sourceNodeId: "clause-travel-deadline-active",
      sourceNodeType: "CLAUSE",
      targetNodeId: "artifact-finance-procedure",
      targetNodeType: "ARTIFACT",
      relationshipType: "REFERENCED_BY",
      status: "APPROVED",
      rationale: "The finance procedure references the deadline clause.",
    },
  });

  await prisma.dependencyEdge.upsert({
    where: { id: "edge-form-rule" },
    update: { status: "APPROVED" },
    create: {
      id: "edge-form-rule",
      organizationId: ORGANIZATION_ID,
      sourceNodeId: "artifact-travel-claim-form",
      sourceNodeType: "ARTIFACT",
      targetNodeId: "artifact-deadline-rule",
      targetNodeType: "ARTIFACT",
      relationshipType: "CONSUMED_BY",
      status: "APPROVED",
      rationale:
        "The backend validation rule consumes claims submitted via the form.",
    },
  });
}

await main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
