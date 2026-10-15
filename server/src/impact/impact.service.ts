import { BadRequestException, HttpStatus, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ContractHttpException } from '../common/contract-http.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { classifyClauseChanges } from '../policies/change-classifier.js';
import type { ClauseChangeDto } from '../policies/dto.js';
import { relationshipLabel, type GraphEdgeDto, type GraphNodeDto } from '../graph/dto.js';
import { runImpactBfs, type ImpactPath } from './bfs.js';
import { buildImpactReason } from './reason-builder.js';
import type { ImpactReportDto, ImpactResultDto, ReviewStatus } from './dto.js';

interface StoredPath {
  nodes: { id: string; type: 'CLAUSE' | 'ARTIFACT'; label: string }[];
  edges: { id: string; relationshipType: string }[];
}

@Injectable()
export class ImpactService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async createImpactRun(versionId: string): Promise<ImpactReportDto> {
    const version = await this.prisma.policyVersion.findUnique({
      where: { id: versionId },
      include: { policy: true, clauses: true },
    });
    if (!version) {
      throw new NotFoundException(`Policy version ${versionId} not found`);
    }
    const baseVersion = await this.prisma.policyVersion.findFirst({
      where: { policyId: version.policyId, versionNumber: { lt: version.versionNumber } },
      orderBy: { versionNumber: 'desc' },
      include: { clauses: true },
    });
    if (!baseVersion) {
      throw new ContractHttpException('NO_BASE_VERSION', `Policy version ${versionId} has no earlier version`, HttpStatus.CONFLICT);
    }

    const changes = classifyClauseChanges(baseVersion.clauses, version.clauses);
    const changedClauses = changes.filter(
      (change) => change.changeType === 'MODIFIED' || change.changeType === 'REMOVED',
    );
    const traversableChanges = changedClauses;

    const edges = await this.prisma.dependencyEdge.findMany({
      where: { policyId: version.policyId },
    });
    const artifactIds = [...new Set(edges.flatMap((edge) => [edge.sourceArtifactId, edge.targetArtifactId]).filter((id): id is string => id !== null))];
    const artifacts = await this.prisma.artifact.findMany({
      where: { id: { in: artifactIds } },
    });
    const artifactsById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
    const edgesById = new Map(edges.map((edge) => [edge.id, edge]));

    const traversalEdges = edges.map((edge) => ({
      id: edge.id,
      sourceNodeId: edge.sourceType === 'CLAUSE' ? `clause:${edge.sourceClauseKey}` : `artifact:${edge.sourceArtifactId}`,
      targetNodeId: `artifact:${edge.targetArtifactId}`,
      status: edge.status,
    }));
    const paths = runImpactBfs(
      traversableChanges.map((change) => ({ stableKey: change.stableKey, changeType: change.changeType })),
      traversalEdges,
      new Set([...artifactsById.keys()].map((id) => `artifact:${id}`)),
    );
    const orderedPaths = this.sortPaths(paths, artifactsById);

    const originByStartNodeId = new Map(traversableChanges.map((change) => [change.stableKey, change]));
    const clausesById = new Map(baseVersion.clauses.map((clause) => [`clause:${clause.stableKey}`, clause]));

    const created = await this.prisma.$transaction(async (transaction) => {
      const run = await transaction.impactRun.create({
        data: { policyVersionId: version.id, baseVersionId: baseVersion.id },
      });
      if (orderedPaths.length > 0) {
        await transaction.impactResult.createMany({
          data: orderedPaths.map((path) => {
            const origin = originByStartNodeId.get(path.changedClauseKey);
            const artifact = artifactsById.get(path.artifactId);
            if (!origin || !artifact) {
              throw new BadRequestException('Impact path references an unknown node');
            }
            // Stored inline per MVP_SPEC: pathJson holds the ordered nodes
            // and edges directly. Round-tripped through JSON so the value
            // satisfies the Prisma Json input type.
            return {
              impactRunId: run.id,
              changedClauseKey: origin.stableKey,
              artifactId: path.artifactId,
              distance: path.distance,
              pathJson: JSON.parse(JSON.stringify({
                nodes: this.buildPathNodes(path.pathNodeIds, clausesById, artifactsById).map(({ id, nodeType, name }) => ({ id, type: nodeType, label: name })),
                edges: path.pathEdgeIds.map((edgeId) => this.toGraphEdgeDto(edgesById.get(edgeId))).map(({ id, relationshipType }) => ({ id, relationshipType })),
              })) as Prisma.InputJsonValue,
              reason: buildImpactReason(origin.changeType as 'MODIFIED' | 'REMOVED', origin.stableKey, artifact.name, {
                nodes: this.buildPathNodes(path.pathNodeIds, clausesById, artifactsById),
                edges: path.pathEdgeIds.map((edgeId) => this.toGraphEdgeDto(edgesById.get(edgeId))),
              }),
              reviewStatus: 'PROPOSED' as const,
            };
          }),
        });
      }
      return run;
    });

    return this.getImpactRun(created.id);
  }

  // Complete report: policy/version/change summary, dependency graph, and
  // artifact-enriched results with full paths.
  async getImpactRun(impactRunId: string): Promise<ImpactReportDto> {
    const run = await this.prisma.impactRun.findUnique({
      where: { id: impactRunId },
      include: {
        policyVersion: { include: { policy: true, clauses: true } },
        results: { include: { artifact: true }, orderBy: [{ distance: 'asc' }] },
      },
    });
    if (!run) {
      throw new NotFoundException(`Impact run ${impactRunId} not found`);
    }
    const baseVersion = await this.prisma.policyVersion.findUnique({
      where: { id: run.baseVersionId },
      include: { clauses: true },
    });
    if (!baseVersion || baseVersion.policyId !== run.policyVersion.policyId) {
      throw new NotFoundException(`Base version ${run.baseVersionId} not found`);
    }
    const changes = classifyClauseChanges(baseVersion.clauses, run.policyVersion.clauses);
    const changeSummary: ClauseChangeDto[] = changes.map((change) => ({
      stableKey: change.stableKey,
      changeType: change.changeType,
      activeClause: change.predecessorClause
        ? {
            id: change.predecessorClause.id,
            policyVersionId: change.predecessorClause.policyVersionId,
            stableKey: change.predecessorClause.stableKey,
            text: change.predecessorClause.text,
            position: change.predecessorClause.position,
            textHash: change.predecessorClause.textHash,
          }
        : null,
      draftClause: change.draftClause
        ? {
            id: change.draftClause.id,
            policyVersionId: change.draftClause.policyVersionId,
            stableKey: change.draftClause.stableKey,
            text: change.draftClause.text,
            position: change.draftClause.position,
            textHash: change.draftClause.textHash,
          }
        : null,
    }));
    const results = run.results
      .map((result) => this.toImpactResultDto(result))
      .sort((a, b) => a.artifact.department.localeCompare(b.artifact.department) || a.artifact.name.localeCompare(b.artifact.name) || a.changedClauseKey.localeCompare(b.changedClauseKey));
    return {
      id: run.id,
      policyId: run.policyVersion.policyId,
      policyTitle: run.policyVersion.policy.title,
      versionId: run.policyVersionId,
      baseVersionId: run.baseVersionId,
      createdAt: run.createdAt.toISOString(),
      changedClauses: changeSummary.map((change) => ({ stableKey: change.stableKey, changeType: change.changeType, oldText: change.activeClause?.text ?? null, newText: change.draftClause?.text ?? null })),
      affectedDepartments: [...new Set(results.map((result) => result.artifact.department))].sort(),
      results,
    };
  }

  async listImpactRuns(versionId: string): Promise<{ id: string; createdAt: string; resultCount: number }[]> {
    const version = await this.prisma.policyVersion.findUnique({ where: { id: versionId }, select: { id: true } });
    if (!version) throw new NotFoundException(`Policy version ${versionId} not found`);
    const runs = await this.prisma.impactRun.findMany({ where: { policyVersionId: versionId }, include: { _count: { select: { results: true } } }, orderBy: { createdAt: 'desc' } });
    return runs.map((run) => ({ id: run.id, createdAt: run.createdAt.toISOString(), resultCount: run._count.results }));
  }

  // Human review persists the status/comment and returns the updated DTO.
  async updateImpactResult(
    impactResultId: string,
    reviewStatus: ReviewStatus,
    reviewComment?: string,
  ): Promise<ImpactResultDto> {
    const existing = await this.prisma.impactResult.findUnique({
      where: { id: impactResultId },
    });
    if (!existing) {
      throw new NotFoundException(`Impact result ${impactResultId} not found`);
    }
    const updated = await this.prisma.impactResult.update({
      where: { id: impactResultId },
      data: {
        reviewStatus,
        ...(reviewComment !== undefined ? { reviewComment } : {}),
      },
      include: { artifact: true },
    });
    return this.toImpactResultDto(updated);
  }

  private sortPaths(
    paths: ImpactPath[],
    artifactsById: Map<string, { name: string }>,
  ): ImpactPath[] {
    return [...paths].sort(
      (a, b) =>
        a.distance - b.distance ||
        (artifactsById.get(a.artifactId)?.name ?? '').localeCompare(
          artifactsById.get(b.artifactId)?.name ?? '',
        ),
    );
  }

  private buildPathNodes(
    pathNodeIds: string[],
    clausesById: Map<string, { stableKey: string }>,
    artifactsById: Map<
      string,
      { id: string; name: string; type: 'FORM' | 'PROCEDURE' | 'CHECKLIST' | 'TRAINING_MATERIAL' | 'DEPARTMENT_INSTRUCTION' | 'INFORMATION_SHEET'; description: string | null }
    >,
  ): GraphNodeDto[] {
    return pathNodeIds.map((nodeId) => {
      const clause = clausesById.get(nodeId);
      if (clause) {
        // Clause display name is the stableKey (e.g. TRAVEL-CLAIM-DEADLINE).
        return { id: nodeId, nodeType: 'CLAUSE' as const, name: clause.stableKey };
      }
      const artifact = artifactsById.get(nodeId.slice('artifact:'.length));
      if (!artifact) {
        throw new BadRequestException(`Impact path references unknown node ${nodeId}`);
      }
      return {
        id: `artifact:${artifact.id}`,
        nodeType: 'ARTIFACT' as const,
        name: artifact.name,
        artifactType: artifact.type,
        description: artifact.description,
      };
    });
  }

  private toGraphEdgeDto(edge: {
    id: string;
    sourceType: string;
    sourceClauseKey: string | null;
    sourceArtifactId: string | null;
    targetArtifactId: string;
    relationshipType: string;
    status: string;
    rationale: string | null;
  } | undefined): GraphEdgeDto {
    if (!edge) {
      throw new BadRequestException('Impact path references an unknown edge');
    }
    return {
      id: edge.id,
      sourceNodeId: edge.sourceType === 'CLAUSE' ? `clause:${edge.sourceClauseKey}` : `artifact:${edge.sourceArtifactId}`,
      targetNodeId: `artifact:${edge.targetArtifactId}`,
      relationshipType: edge.relationshipType,
      relationshipLabel: relationshipLabel(edge.relationshipType),
      status: edge.status,
      rationale: edge.rationale,
    };
  }

  private toImpactResultDto(result: {
    id: string;
    distance: number;
    pathJson: unknown;
    reason: string;
    reviewStatus: ReviewStatus;
    reviewComment: string | null;
    artifact: {
      id: string;
      name: string;
      type: 'FORM' | 'PROCEDURE' | 'CHECKLIST' | 'TRAINING_MATERIAL' | 'DEPARTMENT_INSTRUCTION' | 'INFORMATION_SHEET';
      description: string | null;
      department: string;
    };
  }): ImpactResultDto {
    const path = this.validateStoredPath(result.pathJson);
    return {
      id: result.id,
      changedClauseKey: (result as typeof result & { changedClauseKey: string }).changedClauseKey,
      artifact: {
        id: result.artifact.id,
        name: result.artifact.name,
        type: result.artifact.type,
        department: result.artifact.department,
      },
      distance: result.distance,
      reason: result.reason,
      reviewStatus: result.reviewStatus,
      reviewComment: result.reviewComment,
      path: { nodes: path.nodes, edges: path.edges },
    };
  }

  private validateStoredPath(value: unknown): StoredPath {
    if (!value || typeof value !== 'object' || !('nodes' in value) || !('edges' in value)
      || !Array.isArray(value.nodes) || !Array.isArray(value.edges)
      || value.nodes.length < 2 || value.edges.length !== value.nodes.length - 1
      || !value.nodes.every((node) => node && typeof node === 'object' && typeof node.id === 'string' && typeof node.label === 'string' && (node.type === 'CLAUSE' || node.type === 'ARTIFACT'))
      || !value.edges.every((edge) => edge && typeof edge === 'object' && typeof edge.id === 'string' && typeof edge.relationshipType === 'string')) {
      throw new InternalServerErrorException('Persisted impact path is corrupt');
    }
    const nodes = value.nodes as Record<string, unknown>[];
    const edges = value.edges as Record<string, unknown>[];
    if (!nodes.every((node) => typeof node.type === 'string' && typeof node.label === 'string')
      || !edges.every((edge) => ['GOVERNS', 'UPDATES', 'APPEARS_IN'].includes(String(edge.relationshipType)))) {
      throw new InternalServerErrorException('Persisted impact path is corrupt');
    }
    return value as unknown as StoredPath;
  }
}
