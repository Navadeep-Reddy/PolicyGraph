import { BadRequestException, ConflictException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ContractHttpException } from '../common/contract-http.exception.js';
import { ClauseExtractionService } from '../ai/clause-extraction.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { classifyClauseChanges, hashClauseText } from './change-classifier.js';
import type {
  VersionClauseDto,
  PolicyDetailDto,
  PolicySummaryDto,
  VersionClauseChangeDto,
  VersionDetailDto,
  VersionDto,
  CreatePolicyDto,
  CreatePolicyResponseDto,
  CreateRevisionDto,
  CreateClauseDto,
  UpdateClauseDto,
} from './dto.js';

interface ClauseRow {
  id: string;
  policyVersionId: string;
  stableKey: string;
  title: string;
  text: string;
  category: string;
  position: number;
  textHash: string;
}

function toVersionClauseDto(clause: ClauseRow): VersionClauseDto {
  return { id: clause.id, versionId: clause.policyVersionId, stableKey: clause.stableKey, title: clause.title,
    text: clause.text, category: clause.category, position: clause.position };
}

@Injectable()
export class PoliciesService {
  constructor(private readonly prisma: PrismaService, private readonly clauseExtraction?: ClauseExtractionService) {}

  async createPolicy(input: CreatePolicyDto): Promise<CreatePolicyResponseDto> {
    const extracted = await this.clauseExtraction!.extract(input.text);
    const created = await this.prisma.policy.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        versions: {
          create: {
            versionNumber: 1,
            status: 'DRAFT',
            publishedAt: null,
            clauses: {
              create: extracted.map((clause) => ({
                stableKey: clause.stableKey,
                title: clause.title,
                text: clause.text,
                category: clause.category,
                position: clause.position,
                textHash: hashClauseText(clause.text),
              })),
            },
          },
        },
      },
      include: { versions: { include: { clauses: { orderBy: { position: 'asc' } } } } },
    });
    const version = created.versions[0];
    return {
      policy: {
        id: created.id,
        title: created.title,
        description: created.description,
        versions: [this.toVersion(version)],
      },
      draft: {
        ...this.toVersion(version),
        clauses: [...version.clauses].sort((left, right) => left.position - right.position).map(toVersionClauseDto),
      },
    };
  }

  async createRevision(policyId: string, input: CreateRevisionDto): Promise<VersionDetailDto> {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
      include: { versions: { include: { clauses: { orderBy: { position: 'asc' } } } } },
    });
    if (!policy) throw new NotFoundException('Policy not found');
    const active = policy.versions.find((version) => version.status === 'ACTIVE');
    if (policy.versions.some((version) => version.status === 'DRAFT') || !active) {
      throw new ConflictException('Cannot create a revision in the current policy state');
    }

    const extracted = input.text === undefined ? null : await this.clauseExtraction!.extract(
      input.text,
      active.clauses.map((clause) => ({ stableKey: clause.stableKey, text: clause.text })),
    );

    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.policy.findUnique({
        where: { id: policyId },
        include: { versions: { include: { clauses: { orderBy: { position: 'asc' } } } } },
      });
      if (!current) throw new NotFoundException('Policy not found');
      const currentActive = current.versions.find((version) => version.status === 'ACTIVE');
      if (current.versions.some((version) => version.status === 'DRAFT') || !currentActive) {
        throw new ConflictException('Cannot create a revision in the current policy state');
      }
      if (extracted && currentActive.id !== active.id) {
        throw new ConflictException('Active version changed while creating the revision');
      }
      const versionNumber = Math.max(...current.versions.map((version) => version.versionNumber)) + 1;
      const clauses = extracted ?? currentActive.clauses.map((clause) => ({
        stableKey: clause.stableKey, title: clause.title, text: clause.text,
        category: clause.category, position: clause.position,
      }));
      const created = await transaction.policyVersion.create({
        data: {
          policyId, versionNumber, status: 'DRAFT', publishedAt: null,
          clauses: { create: clauses.map((clause) => ({ ...clause, textHash: hashClauseText(clause.text) })) },
        },
        include: { clauses: { orderBy: { position: 'asc' } } },
      });
      return {
        ...this.toVersion(created),
        clauses: [...created.clauses].sort((left, right) => left.position - right.position).map(toVersionClauseDto),
      };
    });
  }

  // Dashboard data: one row per policy with version summaries, the approved
  // dependency count for the policy, and the latest impact run
  // (if any) across all versions of the policy.
  async listPolicies(): Promise<PolicySummaryDto[]> {
    const policies = await this.prisma.policy.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        versions: { select: { id: true, versionNumber: true, status: true } },
      },
    });
    return Promise.all(
      policies.map(async (policy) => {
        const activeVersion = policy.versions.find((version) => version.status === 'ACTIVE') ?? null;
        const draftVersion = policy.versions.find((version) => version.status === 'DRAFT') ?? null;
        const [approvedDependencyCount, latestImpactRun] = await Promise.all([
          this.prisma.dependencyEdge.count({
            where: { policyId: policy.id, status: 'APPROVED' },
          }),
          this.prisma.impactRun.findFirst({
            where: { policyVersion: { policyId: policy.id } },
            orderBy: { createdAt: 'desc' },
          }),
        ]);
        return {
          id: policy.id,
          title: policy.title,
          description: policy.description,
          activeVersionNumber: activeVersion?.versionNumber ?? null,
          draftVersionId: draftVersion?.id ?? null,
          activeVersionId: activeVersion?.id ?? null,
          approvedDependencyCount,
          latestImpactRunId: latestImpactRun?.id ?? null,
          updatedAt: policy.updatedAt.toISOString(),
        };
      }),
    );
  }

  // Policy comparison data: active and draft versions with their clauses.
  async getPolicy(policyId: string): Promise<PolicyDetailDto> {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
      include: { versions: { orderBy: { versionNumber: 'desc' } } },
    });
    if (!policy) {
      throw new NotFoundException(`Policy ${policyId} not found`);
    }
    return {
      id: policy.id,
      title: policy.title,
      description: policy.description,
      versions: [...policy.versions]
        .sort((left, right) => right.versionNumber - left.versionNumber)
        .map((version) => this.toVersion(version)),
    };
  }

  async getVersion(versionId: string): Promise<VersionDetailDto> {
    const version = await this.prisma.policyVersion.findUnique({
      where: { id: versionId },
      include: { clauses: { orderBy: { position: 'asc' } } },
    });
    if (!version) {
      throw new NotFoundException(`Policy version ${versionId} not found`);
    }
    return {
      ...this.toVersion(version),
      clauses: [...version.clauses].sort((left, right) => left.position - right.position).map(toVersionClauseDto),
    };
  }

  async publishVersion(versionId: string): Promise<VersionDetailDto> {
    return this.prisma.$transaction(async (transaction) => {
      const version = await transaction.policyVersion.findUnique({
        where: { id: versionId },
        include: { clauses: { orderBy: { position: 'asc' } } },
      });
      if (!version) throw new NotFoundException(`Policy version ${versionId} not found`);
      if (version.status !== 'DRAFT' || version.clauses.length === 0) {
        throw new ConflictException('Policy version cannot be published in its current state');
      }
      const publishedAt = new Date();
      await transaction.policyVersion.updateMany({
        where: { policyId: version.policyId, status: 'ACTIVE' },
        data: { status: 'ARCHIVED' },
      });
      const published = await transaction.policyVersion.update({
        where: { id: versionId },
        data: { status: 'ACTIVE', publishedAt },
        include: { clauses: { orderBy: { position: 'asc' } } },
      });
      return {
        ...this.toVersion(published),
        clauses: [...published.clauses].sort((left, right) => left.position - right.position).map(toVersionClauseDto),
      };
    });
  }

  async createClause(versionId: string, input: CreateClauseDto): Promise<VersionClauseDto> {
    const version = await this.prisma.policyVersion.findUnique({ where: { id: versionId }, include: { clauses: true } });
    if (!version) throw new NotFoundException(`Policy version ${versionId} not found`);
    if (version.status !== 'DRAFT') throw new ConflictException(`Policy version ${versionId} is not DRAFT`);
    if (version.clauses.some((clause) => clause.stableKey === input.stableKey)) {
      throw new ConflictException(`Clause key ${input.stableKey} already exists`);
    }
    try {
      const created = await this.prisma.clause.create({ data: {
        policyVersionId: versionId, ...input,
        position: version.clauses.length ? Math.max(...version.clauses.map((clause) => clause.position)) + 1 : 0,
        textHash: hashClauseText(input.text),
      } });
      return toVersionClauseDto(created);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new ConflictException(`Clause key ${input.stableKey} already exists`);
      }
      throw error;
    }
  }

  async updateClause(versionId: string, clauseId: string, input: UpdateClauseDto): Promise<VersionClauseDto> {
    if (![input.title, input.text, input.category].some((value) => value !== undefined)) {
      throw new BadRequestException('At least one clause field must be provided');
    }
    const version = await this.prisma.policyVersion.findUnique({ where: { id: versionId } });
    if (!version) {
      throw new NotFoundException(`Policy version ${versionId} not found`);
    }
    if (version.status !== 'DRAFT') {
      throw new ConflictException(`Policy version ${versionId} is not DRAFT`);
    }
    const clause = await this.prisma.clause.findFirst({
      where: { id: clauseId, policyVersionId: versionId },
    });
    if (!clause) {
      throw new NotFoundException(`Clause ${clauseId} not found in version ${versionId}`);
    }
    const resultingText = input.text ?? clause.text;
    const updated = await this.prisma.clause.update({
      where: { id: clause.id },
      data: { ...input, textHash: hashClauseText(resultingText) },
    });
    return toVersionClauseDto(updated);
  }

  async deleteClause(versionId: string, clauseId: string): Promise<void> {
    const version = await this.prisma.policyVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new NotFoundException(`Policy version ${versionId} not found`);
    if (version.status !== 'DRAFT') throw new ConflictException(`Policy version ${versionId} is not DRAFT`);
    const clause = await this.prisma.clause.findFirst({ where: { id: clauseId, policyVersionId: versionId } });
    if (!clause) throw new NotFoundException(`Clause ${clauseId} not found in version ${versionId}`);
    await this.prisma.clause.delete({ where: { id: clauseId } });
  }

  // Stable-key comparison of the ACTIVE predecessor clauses against the
  // requested version's clauses. Requesting the ACTIVE version itself yields
  // all UNCHANGED; requesting the DRAFT yields the real diff.
  async getChanges(versionId: string, against?: string): Promise<VersionClauseChangeDto[]> {
    const version = await this.prisma.policyVersion.findUnique({
      where: { id: versionId },
      include: { clauses: true },
    });
    if (!version) {
      throw new NotFoundException(`Policy version ${versionId} not found`);
    }
    const baseVersion = against === undefined
      ? await this.prisma.policyVersion.findFirst({
        where: { policyId: version.policyId, versionNumber: version.versionNumber - 1 },
        include: { clauses: true },
      })
      : await this.prisma.policyVersion.findFirst({
        where: { id: against, policyId: version.policyId },
        include: { clauses: true },
      });
    if (!baseVersion) {
      if (against !== undefined) throw new NotFoundException(`Base version ${against} not found in policy ${version.policyId}`);
      throw new ContractHttpException('NO_BASE_VERSION', `Policy version ${versionId} has no previous version`, HttpStatus.CONFLICT);
    }
    const changes = classifyClauseChanges(baseVersion.clauses, version.clauses);
    return changes.map((change) => ({
      stableKey: change.stableKey,
      changeType: change.changeType,
      before: change.before ? toVersionClauseDto(change.before) : null,
      after: change.after ? toVersionClauseDto(change.after) : null,
    }));
  }

  private toVersion(version: {
    id: string;
    policyId: string;
    versionNumber: number;
    status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
    publishedAt: Date | null;
    createdAt: Date;
  }): VersionDto {
    return {
      id: version.id,
      policyId: version.policyId,
      versionNumber: version.versionNumber,
      status: version.status,
      publishedAt: version.publishedAt?.toISOString() ?? null,
      createdAt: version.createdAt.toISOString(),
    };
  }
}
