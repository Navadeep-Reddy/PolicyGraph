import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateDependencyDto, DependencyDto, UpdateDependencyDto } from './dto.js';
import type { DependencySuggestionsDto } from './dto.js';
import { DependencySuggestionService } from '../ai/dependency-suggestion.service.js';

const selection = { id: true, policyId: true, sourceType: true, sourceClauseKey: true, sourceArtifactId: true,
  targetArtifactId: true, relationshipType: true, status: true, origin: true, rationale: true,
  sourceArtifact: { select: { name: true } }, targetArtifact: { select: { name: true } } } satisfies Prisma.DependencyEdgeSelect;

type Edge = Prisma.DependencyEdgeGetPayload<{ select: typeof selection }>;
function prismaErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
}
function toDto(edge: Edge): DependencyDto {
  return { id: edge.id, policyId: edge.policyId, sourceType: edge.sourceType, sourceClauseKey: edge.sourceClauseKey,
    sourceArtifactId: edge.sourceArtifactId, sourceLabel: edge.sourceType === 'CLAUSE' ? edge.sourceClauseKey! : edge.sourceArtifact!.name,
    targetArtifactId: edge.targetArtifactId, targetLabel: edge.targetArtifact.name,
    relationshipType: edge.relationshipType, status: edge.status, origin: edge.origin, rationale: edge.rationale };
}
function identity(edge: { sourceType: string; sourceClauseKey: string | null; sourceArtifactId: string | null; targetArtifactId: string; relationshipType: string }): string {
  return JSON.stringify([edge.sourceType, edge.sourceClauseKey, edge.sourceArtifactId, edge.targetArtifactId, edge.relationshipType]);
}

@Injectable()
export class DependenciesService {
  constructor(private readonly prisma: PrismaService, private readonly suggestionService: DependencySuggestionService) {}

  async suggest(policyId: string, versionId?: string): Promise<DependencySuggestionsDto> {
    const policy = await this.prisma.policy.findUnique({ where: { id: policyId }, select: { id: true } });
    if (!policy) throw new NotFoundException('Policy not found');
    const version = versionId
      ? await this.prisma.policyVersion.findFirst({ where: { id: versionId, policyId }, select: { id: true, clauses: { select: { stableKey: true, title: true, text: true, category: true }, orderBy: { position: 'asc' } } } })
      : await this.prisma.policyVersion.findFirst({ where: { policyId, status: 'DRAFT' }, select: { id: true, clauses: { select: { stableKey: true, title: true, text: true, category: true }, orderBy: { position: 'asc' } } } })
        ?? await this.prisma.policyVersion.findFirst({ where: { policyId, status: 'ACTIVE' }, select: { id: true, clauses: { select: { stableKey: true, title: true, text: true, category: true }, orderBy: { position: 'asc' } } } });
    if (!version) throw new NotFoundException(versionId ? 'Version not found' : 'Policy version not found');
    const [artifacts, existingRows] = await Promise.all([
      this.prisma.artifact.findMany({ select: { id: true, name: true, type: true, department: true, description: true }, orderBy: { id: 'asc' } }),
      this.prisma.dependencyEdge.findMany({ where: { policyId }, select: { sourceType: true, sourceClauseKey: true, sourceArtifactId: true, targetArtifactId: true, relationshipType: true } }),
    ]);
    const suggestions = await this.suggestionService.suggest({ clauses: version.clauses, artifacts, existing: existingRows });
    const clauseKeys = new Set(version.clauses.map((clause) => clause.stableKey));
    const artifactIds = new Set(artifacts.map((artifact) => artifact.id));
    const identities = new Set(existingRows.map(identity));
    const accepted = [] as typeof suggestions;
    let skipped = 0;
    for (const suggestion of suggestions) {
      const sourceValid = suggestion.sourceType === 'CLAUSE'
        ? suggestion.sourceClauseKey !== null && clauseKeys.has(suggestion.sourceClauseKey) && suggestion.sourceArtifactId === null
        : suggestion.sourceArtifactId !== null && artifactIds.has(suggestion.sourceArtifactId) && suggestion.sourceClauseKey === null && suggestion.sourceArtifactId !== suggestion.targetArtifactId;
      if (!sourceValid || !artifactIds.has(suggestion.targetArtifactId)) { skipped++; continue; }
      const key = identity(suggestion);
      if (identities.has(key)) { skipped++; continue; }
      identities.add(key); accepted.push(suggestion);
    }
    if (!accepted.length) return { created: [], skipped };
    const createdRows = await this.prisma.$transaction(async (tx) => Promise.all(accepted.map((suggestion) => tx.dependencyEdge.create({ data: {
      policyId, sourceType: suggestion.sourceType, sourceClauseKey: suggestion.sourceClauseKey, sourceArtifactId: suggestion.sourceArtifactId,
      targetArtifactId: suggestion.targetArtifactId, relationshipType: suggestion.relationshipType, rationale: suggestion.rationale, status: 'PROPOSED', origin: 'AI',
    }, select: selection }))), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { created: createdRows.map(toDto), skipped };
  }

  async list(policyId: string, status?: 'PROPOSED' | 'APPROVED' | 'REJECTED'): Promise<DependencyDto[]> {
    if (!await this.prisma.policy.findUnique({ where: { id: policyId }, select: { id: true } })) throw new NotFoundException('Policy not found');
    const rows = await this.prisma.dependencyEdge.findMany({ where: { policyId, ...(status ? { status } : {}) },
      select: selection, orderBy: [{ sourceType: 'asc' }, { sourceClauseKey: 'asc' }, { sourceArtifactId: 'asc' }, { targetArtifactId: 'asc' }, { relationshipType: 'asc' }, { id: 'asc' }] });
    return rows.map(toDto);
  }

  async create(policyId: string, input: CreateDependencyDto): Promise<DependencyDto> {
    if (!await this.prisma.policy.findUnique({ where: { id: policyId }, select: { id: true } })) throw new NotFoundException('Policy not found');
    if ((input.sourceType === 'CLAUSE' && (!input.sourceClauseKey || input.sourceArtifactId !== undefined)) ||
      (input.sourceType === 'ARTIFACT' && (!input.sourceArtifactId || input.sourceClauseKey !== undefined))) {
      throw new BadRequestException('Source fields must match sourceType');
    }
    if (input.sourceType === 'CLAUSE') {
      const clause = await this.prisma.clause.findFirst({ where: { stableKey: input.sourceClauseKey,
        policyVersion: { policyId } }, select: { id: true } });
      if (!clause) throw new BadRequestException('Unknown clause key for policy');
    } else if (!await this.prisma.artifact.findUnique({ where: { id: input.sourceArtifactId }, select: { id: true } })) {
      throw new BadRequestException('Unknown source artifact');
    }
    const [target, sourceSame] = await Promise.all([
      this.prisma.artifact.findUnique({ where: { id: input.targetArtifactId }, select: { id: true } }),
      input.sourceType === 'ARTIFACT' ? Promise.resolve(input.sourceArtifactId === input.targetArtifactId) : Promise.resolve(false),
    ]);
    if (!target) throw new BadRequestException('Unknown target artifact');
    if (sourceSame) throw new BadRequestException('Dependency cannot link an artifact to itself');
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const duplicate = await tx.dependencyEdge.findFirst({ where: { policyId, sourceType: input.sourceType,
          sourceClauseKey: input.sourceType === 'CLAUSE' ? input.sourceClauseKey : null,
          sourceArtifactId: input.sourceType === 'ARTIFACT' ? input.sourceArtifactId : null,
          targetArtifactId: input.targetArtifactId, relationshipType: input.relationshipType }, select: { id: true } });
        if (duplicate) throw new ConflictException('Duplicate dependency');
        return tx.dependencyEdge.create({ data: { policyId, sourceType: input.sourceType,
          sourceClauseKey: input.sourceType === 'CLAUSE' ? input.sourceClauseKey : null,
          sourceArtifactId: input.sourceType === 'ARTIFACT' ? input.sourceArtifactId : null,
          targetArtifactId: input.targetArtifactId, relationshipType: input.relationshipType,
          rationale: input.rationale ?? null, status: 'APPROVED', origin: 'MANUAL' }, select: selection });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return toDto(created);
    } catch (error) {
      if (prismaErrorCode(error) === 'P2002') throw new ConflictException('Duplicate dependency');
      throw error;
    }
  }

  async update(id: string, input: UpdateDependencyDto): Promise<DependencyDto> {
    if (Object.keys(input).length === 0) throw new BadRequestException('At least one dependency field must be provided');
    const current = await this.prisma.dependencyEdge.findUnique({ where: { id }, select: selection });
    if (!current) throw new NotFoundException('Dependency not found');
    const relationshipType = input.relationshipType ?? current.relationshipType;
    if (input.relationshipType && input.relationshipType !== current.relationshipType) {
      const duplicate = await this.prisma.dependencyEdge.findFirst({ where: { id: { not: id }, policyId: current.policyId,
        sourceType: current.sourceType, sourceClauseKey: current.sourceClauseKey, sourceArtifactId: current.sourceArtifactId,
        targetArtifactId: current.targetArtifactId, relationshipType }, select: { id: true } });
      if (duplicate) throw new ConflictException('Duplicate dependency');
    }
    try {
      return toDto(await this.prisma.dependencyEdge.update({ where: { id }, data: { ...(input.status ? { status: input.status } : {}),
        ...(input.relationshipType ? { relationshipType } : {}), ...(input.rationale !== undefined ? { rationale: input.rationale } : {}) }, select: selection }));
    } catch (error) {
      if (prismaErrorCode(error) === 'P2025') throw new NotFoundException('Dependency not found');
      if (prismaErrorCode(error) === 'P2002') throw new ConflictException('Duplicate dependency');
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try { await this.prisma.dependencyEdge.delete({ where: { id } }); }
    catch (error) {
      if (prismaErrorCode(error) === 'P2025') throw new NotFoundException('Dependency not found');
      throw error;
    }
  }
}
