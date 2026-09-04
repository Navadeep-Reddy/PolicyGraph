-- CreateEnum
CREATE TYPE "PolicyVersionStatus" AS ENUM ('ACTIVE', 'DRAFT');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('FORM', 'PROCEDURE', 'SOFTWARE_RULE');

-- CreateEnum
CREATE TYPE "DependencyNodeType" AS ENUM ('CLAUSE', 'ARTIFACT');

-- CreateEnum
CREATE TYPE "EdgeRelationship" AS ENUM ('IMPLEMENTED_BY', 'REFERENCED_BY', 'CONSUMED_BY');

-- CreateEnum
CREATE TYPE "EdgeStatus" AS ENUM ('APPROVED', 'PROPOSED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'DISMISSED', 'RESOLVED');

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyVersion" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "PolicyVersionStatus" NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clause" (
    "id" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "stableKey" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "textHash" TEXT NOT NULL,

    CONSTRAINT "Clause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ArtifactType" NOT NULL,
    "description" TEXT,
    "criticality" INTEGER NOT NULL,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DependencyEdge" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "sourceNodeType" "DependencyNodeType" NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "targetNodeType" "DependencyNodeType" NOT NULL,
    "relationshipType" "EdgeRelationship" NOT NULL,
    "status" "EdgeStatus" NOT NULL,
    "rationale" TEXT,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),

    CONSTRAINT "DependencyEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactRun" (
    "id" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpactRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactResult" (
    "id" TEXT NOT NULL,
    "impactRunId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "distance" INTEGER NOT NULL,
    "pathJson" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PROPOSED',
    "reviewComment" TEXT,

    CONSTRAINT "ImpactResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PolicyVersion_policyId_versionNumber_key" ON "PolicyVersion"("policyId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Clause_policyVersionId_stableKey_key" ON "Clause"("policyVersionId", "stableKey");

-- CreateIndex
CREATE INDEX "DependencyEdge_sourceNodeId_status_idx" ON "DependencyEdge"("sourceNodeId", "status");

-- CreateIndex
CREATE INDEX "DependencyEdge_targetNodeId_idx" ON "DependencyEdge"("targetNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactResult_impactRunId_artifactId_key" ON "ImpactResult"("impactRunId", "artifactId");

-- AddForeignKey
ALTER TABLE "PolicyVersion" ADD CONSTRAINT "PolicyVersion_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clause" ADD CONSTRAINT "Clause_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PolicyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactRun" ADD CONSTRAINT "ImpactRun_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PolicyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactResult" ADD CONSTRAINT "ImpactResult_impactRunId_fkey" FOREIGN KEY ("impactRunId") REFERENCES "ImpactRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactResult" ADD CONSTRAINT "ImpactResult_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Artifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
