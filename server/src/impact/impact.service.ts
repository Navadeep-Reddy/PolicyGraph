import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { classifyClauseChanges } from '../policies/change-classifier.js';
import type { ClauseChangeDto } from '../policies/dto.js';
import { relationshipLabel, type GraphEdgeDto, type GraphNodeDto } from '../graph/dto.js';
import { GraphService } from '../graph/graph.service.js';
import { runImpactBfs, type ImpactPath } from './bfs.js';
import type { ImpactReportDto, ImpactResultDto, ReviewStatus } from './dto.js';

interface StoredPath {
  nodes: GraphNodeDto[];
  edges: GraphEdgeDto[];
}

@Injectable()
export class ImpactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly graphService: GraphService,
  ) {}

  // Creates an impact run for a (draft) version: determines changed clauses,
  // runs BFS from the ACTIVE predecessor clause nodes (edges are anchored to
  // the ACTIVE clause), then persists the run and its results atomically.
  // The ImpactRun stays linked to the requested draft version.
  async createImpactRun(versionId: string): Promise<ImpactReportDto> {
    const version = await this.prisma.policyVersion.findUnique({
      where: { id: versionId },
      include: { policy: true, clauses: true },
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
    const changedClauses = changes.filter(
      (change) => change.changeType === 'MODIFIED' || change.changeType === 'ADDED',
    );
    if (changedClauses.length === 0) {
      throw new BadRequestException('Version has no changed clauses; nothing to analyze');
    }

    // Dependency edges are anchored to the ACTIVE clause, so each changed
    // draft clause is matched by stableKey to its ACTIVE predecessor and
    // traversal starts at that predecessor node.
    const activeByStableKey = new Map(activeVersion.clauses.map((clause) => [clause.stableKey, clause]));
    const traversableChanges = changedClauses.filter((change) =>
      activeByStableKey.has(change.stableKey),
    );
    if (traversableChanges.length === 0) {
      throw new BadRequestException(
        'Changed clauses have no active predecessor to traverse from',
      );
    }

    const runAt = new Date();
    const edges = await this.prisma.dependencyEdge.findMany({
      where: { organizationId: version.policy.organizationId },
    });
    const artifacts = await this.prisma.artifact.findMany({
      where: { organizationId: version.policy.organizationId },
    });
    const artifactsById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
    const edgesById = new Map(edges.map((edge) => [edge.id, edge]));

    const startNodeIds = traversableChanges.map(
      (change) => activeByStableKey.get(change.stableKey)?.id as string,
    );
    const paths = runImpactBfs(
      startNodeIds,
      edges,
      new Set(artifactsById.keys()),
      runAt,
    );
    const orderedPaths = this.sortPaths(paths, artifactsById);

    const originByStartNodeId = new Map(
      traversableChanges.map((change) => [
        activeByStableKey.get(change.stableKey)?.id as string,
        change,
      ]),
    );
    const clausesById = new Map(activeVersion.clauses.map((clause) => [clause.id, clause]));

    const created = await this.prisma.$transaction(async (transaction) => {
      const run = await transaction.impactRun.create({
        data: { policyVersionId: version.id },
      });
      if (orderedPaths.length > 0) {
        await transaction.impactResult.createMany({
          data: orderedPaths.map((path) => {
            const origin = originByStartNodeId.get(path.pathNodeIds[0] as string);
            const artifact = artifactsById.get(path.artifactId);
            if (!origin || !artifact) {
              throw new BadRequestException('Impact path references an unknown node');
            }
            // Stored inline per MVP_SPEC: pathJson holds the ordered nodes
            // and edges directly. Round-tripped through JSON so the value
            // satisfies the Prisma Json input type.
            const pathJson = JSON.parse(
              JSON.stringify({
                nodes: this.buildPathNodes(path.pathNodeIds, clausesById, artifactsById),
                edges: path.pathEdgeIds.map((edgeId) =>
                  this.toGraphEdgeDto(edgesById.get(edgeId)),
                ),
              }),
            ) as Prisma.InputJsonValue;
            return {
              impactRunId: run.id,
              artifactId: path.artifactId,
              distance: path.distance,
              pathJson,
              reason: this.buildReason(origin.changeType, origin.stableKey, path.distance),
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
    const activeVersion = await this.prisma.policyVersion.findFirst({
      where: { policyId: run.policyVersion.policyId, status: 'ACTIVE' },
      include: { clauses: true },
    });
    if (!activeVersion) {
      throw new NotFoundException(`Policy ${run.policyVersion.policyId} has no active version`);
    }
    const changes = classifyClauseChanges(activeVersion.clauses, run.policyVersion.clauses);
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
    const graph = await this.graphService.getPolicyGraph(run.policyVersion.policyId);
    const results = run.results
      .map((result) => this.toImpactResultDto(result))
      .sort((a, b) => a.distance - b.distance || a.artifact.name.localeCompare(b.artifact.name));
    return {
      id: run.id,
      policyVersionId: run.policyVersionId,
      policyId: run.policyVersion.policyId,
      createdAt: run.createdAt.toISOString(),
      changeSummary,
      graph,
      results,
    };
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

  private buildReason(changeType: string, stableKey: string, distance: number): string {
    const hops = distance === 1 ? '1 hop' : `${distance} hops`;
    return `Downstream of ${changeType} clause ${stableKey} (${hops})`;
  }

  private buildPathNodes(
    pathNodeIds: string[],
    clausesById: Map<string, { stableKey: string }>,
    artifactsById: Map<
      string,
      { id: string; name: string; type: 'FORM' | 'PROCEDURE' | 'SOFTWARE_RULE'; description: string | null }
    >,
  ): GraphNodeDto[] {
    return pathNodeIds.map((nodeId) => {
      const clause = clausesById.get(nodeId);
      if (clause) {
        // Clause display name is the stableKey (e.g. TRAVEL-CLAIM-DEADLINE).
        return { id: nodeId, nodeType: 'CLAUSE' as const, name: clause.stableKey };
      }
      const artifact = artifactsById.get(nodeId);
      if (!artifact) {
        throw new BadRequestException(`Impact path references unknown node ${nodeId}`);
      }
      return {
        id: artifact.id,
        nodeType: 'ARTIFACT' as const,
        name: artifact.name,
        artifactType: artifact.type,
        description: artifact.description,
      };
    });
  }

  private toGraphEdgeDto(edge: {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    relationshipType: string;
    status: string;
    rationale: string | null;
  } | undefined): GraphEdgeDto {
    if (!edge) {
      throw new BadRequestException('Impact path references an unknown edge');
    }
    return {
      id: edge.id,
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
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
      type: 'FORM' | 'PROCEDURE' | 'SOFTWARE_RULE';
      description: string | null;
      criticality: number;
    };
  }): ImpactResultDto {
    const path = result.pathJson as unknown as StoredPath;
    return {
      id: result.id,
      artifact: {
        id: result.artifact.id,
        name: result.artifact.name,
        type: result.artifact.type,
        description: result.artifact.description,
        criticality: result.artifact.criticality,
      },
      distance: result.distance,
      reason: result.reason,
      reviewStatus: result.reviewStatus,
      reviewComment: result.reviewComment,
      path: { nodes: path.nodes, edges: path.edges },
    };
  }
}
