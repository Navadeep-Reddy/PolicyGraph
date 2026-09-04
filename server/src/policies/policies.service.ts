import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { classifyClauseChanges, hashClauseText } from './change-classifier.js';
import type {
  ClauseDto,
  PolicyDetailDto,
  PolicyListItemDto,
  VersionChangesDto,
  VersionSummaryDto,
  VersionWithClausesDto,
} from './dto.js';

interface ClauseRow {
  id: string;
  policyVersionId: string;
  stableKey: string;
  text: string;
  position: number;
  textHash: string;
}

function toClauseDto(clause: ClauseRow): ClauseDto {
  return {
    id: clause.id,
    policyVersionId: clause.policyVersionId,
    stableKey: clause.stableKey,
    text: clause.text,
    position: clause.position,
    textHash: clause.textHash,
  };
}

@Injectable()
export class PoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  // Dashboard data: one row per policy with version summaries, the approved
  // dependency count for the policy organization, and the latest impact run
  // (if any) across all versions of the policy.
  async listPolicies(): Promise<PolicyListItemDto[]> {
    const policies = await this.prisma.policy.findMany({
      orderBy: { title: 'asc' },
      include: {
        versions: {
          orderBy: { versionNumber: 'asc' },
          include: { _count: { select: { clauses: true } } },
        },
      },
    });
    return Promise.all(
      policies.map(async (policy) => {
        const activeVersion = policy.versions.find((version) => version.status === 'ACTIVE') ?? null;
        const draftVersion = policy.versions.find((version) => version.status === 'DRAFT') ?? null;
        const [approvedDependencyCount, latestImpactRun] = await Promise.all([
          this.prisma.dependencyEdge.count({
            where: { organizationId: policy.organizationId, status: 'APPROVED' },
          }),
          this.prisma.impactRun.findFirst({
            where: { policyVersion: { policyId: policy.id } },
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { results: true } } },
          }),
        ]);
        return {
          id: policy.id,
          organizationId: policy.organizationId,
          title: policy.title,
          description: policy.description,
          activeVersion: activeVersion ? this.toVersionSummary(activeVersion) : null,
          draftVersion: draftVersion ? this.toVersionSummary(draftVersion) : null,
          approvedDependencyCount,
          latestImpactRun: latestImpactRun
            ? {
                id: latestImpactRun.id,
                policyVersionId: latestImpactRun.policyVersionId,
                createdAt: latestImpactRun.createdAt.toISOString(),
                resultCount: latestImpactRun._count.results,
              }
            : null,
        };
      }),
    );
  }

  // Policy comparison data: active and draft versions with their clauses.
  async getPolicy(policyId: string): Promise<PolicyDetailDto> {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
      include: { versions: { orderBy: { versionNumber: 'asc' }, include: { clauses: true } } },
    });
    if (!policy) {
      throw new NotFoundException(`Policy ${policyId} not found`);
    }
    const activeVersion = policy.versions.find((version) => version.status === 'ACTIVE') ?? null;
    const draftVersion = policy.versions.find((version) => version.status === 'DRAFT') ?? null;
    return {
      id: policy.id,
      organizationId: policy.organizationId,
      title: policy.title,
      description: policy.description,
      activeVersion: activeVersion ? this.toVersionWithClauses(activeVersion) : null,
      draftVersion: draftVersion ? this.toVersionWithClauses(draftVersion) : null,
    };
  }

  async listVersions(policyId: string): Promise<VersionSummaryDto[]> {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
      include: {
        versions: {
          orderBy: { versionNumber: 'asc' },
          include: { _count: { select: { clauses: true } } },
        },
      },
    });
    if (!policy) {
      throw new NotFoundException(`Policy ${policyId} not found`);
    }
    return policy.versions.map((version) => this.toVersionSummary(version));
  }

  // Draft editing: only the text is editable; the hash is recomputed so
  // change detection observes the edit on the next read.
  async updateClause(versionId: string, clauseId: string, text: string): Promise<ClauseDto> {
    const version = await this.prisma.policyVersion.findUnique({ where: { id: versionId } });
    if (!version) {
      throw new NotFoundException(`Policy version ${versionId} not found`);
    }
    if (version.status !== 'DRAFT') {
      throw new BadRequestException(`Policy version ${versionId} is not DRAFT`);
    }
    const clause = await this.prisma.clause.findFirst({
      where: { id: clauseId, policyVersionId: versionId },
    });
    if (!clause) {
      throw new NotFoundException(`Clause ${clauseId} not found in version ${versionId}`);
    }
    const updated = await this.prisma.clause.update({
      where: { id: clause.id },
      data: { text, textHash: hashClauseText(text) },
    });
    return toClauseDto(updated);
  }

  // Stable-key comparison of the ACTIVE predecessor clauses against the
  // requested version's clauses. Requesting the ACTIVE version itself yields
  // all UNCHANGED; requesting the DRAFT yields the real diff.
  async getChanges(versionId: string): Promise<VersionChangesDto> {
    const version = await this.prisma.policyVersion.findUnique({
      where: { id: versionId },
      include: { clauses: true },
    });
    if (!version) {
      throw new NotFoundException(`Policy version ${versionId} not found`);
    }
    const activeVersion = await this.prisma.policyVersion.findFirst({
      where: { policyId: version.policyId, status: 'ACTIVE' },
      include: { clauses: true },
    });
    if (!activeVersion) {
      throw new NotFoundException(`Policy ${version.policyId} has no active version`);
    }
    const changes = classifyClauseChanges(activeVersion.clauses, version.clauses);
    return {
      versionId: version.id,
      policyId: version.policyId,
      changes: changes.map((change) => ({
        stableKey: change.stableKey,
        changeType: change.changeType,
        activeClause: change.predecessorClause ? toClauseDto(change.predecessorClause) : null,
        draftClause: change.draftClause ? toClauseDto(change.draftClause) : null,
      })),
    };
  }

  private toVersionSummary(version: {
    id: string;
    policyId: string;
    versionNumber: number;
    status: 'ACTIVE' | 'DRAFT';
    effectiveDate: Date | null;
    createdAt: Date;
    _count: { clauses: number };
  }): VersionSummaryDto {
    return {
      id: version.id,
      policyId: version.policyId,
      versionNumber: version.versionNumber,
      status: version.status,
      effectiveDate: version.effectiveDate?.toISOString() ?? null,
      createdAt: version.createdAt.toISOString(),
      clauseCount: version._count.clauses,
    };
  }

  private toVersionWithClauses(version: {
    id: string;
    policyId: string;
    versionNumber: number;
    status: 'ACTIVE' | 'DRAFT';
    effectiveDate: Date | null;
    createdAt: Date;
    clauses: ClauseRow[];
  }): VersionWithClausesDto {
    return {
      id: version.id,
      policyId: version.policyId,
      versionNumber: version.versionNumber,
      status: version.status,
      effectiveDate: version.effectiveDate?.toISOString() ?? null,
      createdAt: version.createdAt.toISOString(),
      clauses: [...version.clauses]
        .sort((a, b) => a.position - b.position)
        .map((clause) => toClauseDto(clause)),
    };
  }
}
