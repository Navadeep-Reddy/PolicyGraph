-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PolicyVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('FORM', 'PROCEDURE', 'CHECKLIST', 'TRAINING_MATERIAL', 'DEPARTMENT_INSTRUCTION', 'INFORMATION_SHEET');

-- CreateEnum
CREATE TYPE "DependencyNodeType" AS ENUM ('CLAUSE', 'ARTIFACT');

-- CreateEnum
CREATE TYPE "EdgeRelationship" AS ENUM ('GOVERNS', 'UPDATES', 'APPEARS_IN');

-- CreateEnum
CREATE TYPE "EdgeStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'DISMISSED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "DependencyOrigin" AS ENUM ('AI', 'MANUAL');

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
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
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clause" (
    "id" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "stableKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "textHash" TEXT NOT NULL,

    CONSTRAINT "Clause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ArtifactType" NOT NULL,
    "department" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DependencyEdge" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "sourceType" "DependencyNodeType" NOT NULL,
    "sourceClauseKey" TEXT,
    "sourceArtifactId" TEXT,
    "targetArtifactId" TEXT NOT NULL,
    "relationshipType" "EdgeRelationship" NOT NULL,
    "status" "EdgeStatus" NOT NULL,
    "origin" "DependencyOrigin" NOT NULL,
    "rationale" TEXT,

    CONSTRAINT "DependencyEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactRun" (
    "id" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "baseVersionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpactRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactResult" (
    "id" TEXT NOT NULL,
    "impactRunId" TEXT NOT NULL,
    "changedClauseKey" TEXT NOT NULL,
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
CREATE INDEX "DependencyEdge_policyId_status_idx" ON "DependencyEdge"("policyId", "status");

-- CreateIndex
CREATE INDEX "DependencyEdge_sourceType_sourceClauseKey_idx" ON "DependencyEdge"("sourceType", "sourceClauseKey");

-- CreateIndex
CREATE INDEX "DependencyEdge_sourceArtifactId_idx" ON "DependencyEdge"("sourceArtifactId");

-- CreateIndex
CREATE INDEX "DependencyEdge_targetArtifactId_idx" ON "DependencyEdge"("targetArtifactId");

-- CreateIndex
CREATE UNIQUE INDEX "ImpactResult_impactRunId_changedClauseKey_artifactId_key" ON "ImpactResult"("impactRunId", "changedClauseKey", "artifactId");

-- AddForeignKey
ALTER TABLE "PolicyVersion" ADD CONSTRAINT "PolicyVersion_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clause" ADD CONSTRAINT "Clause_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PolicyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DependencyEdge" ADD CONSTRAINT "DependencyEdge_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DependencyEdge" ADD CONSTRAINT "DependencyEdge_sourceArtifactId_fkey" FOREIGN KEY ("sourceArtifactId") REFERENCES "Artifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DependencyEdge" ADD CONSTRAINT "DependencyEdge_targetArtifactId_fkey" FOREIGN KEY ("targetArtifactId") REFERENCES "Artifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactRun" ADD CONSTRAINT "ImpactRun_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PolicyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactRun" ADD CONSTRAINT "ImpactRun_baseVersionId_fkey" FOREIGN KEY ("baseVersionId") REFERENCES "PolicyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactResult" ADD CONSTRAINT "ImpactResult_impactRunId_fkey" FOREIGN KEY ("impactRunId") REFERENCES "ImpactRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactResult" ADD CONSTRAINT "ImpactResult_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Artifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

