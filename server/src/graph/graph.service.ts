import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { relationshipLabel, type PolicyGraphDto } from './dto.js';

@Injectable()
export class GraphService {
  constructor(private readonly prisma: PrismaService) {}

  // Readable graph for React Flow: ACTIVE clause nodes (named by stableKey)
  // plus every artifact in the policy organization, with all dependency
  // edges between them. Impact traversal filters to APPROVED edges itself.
  async getPolicyGraph(policyId: string): Promise<PolicyGraphDto> {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
      include: {
        versions: {
          where: { status: 'ACTIVE' },
          include: { clauses: { orderBy: { position: 'asc' } } },
        },
      },
    });
    if (!policy) {
      throw new NotFoundException(`Policy ${policyId} not found`);
    }
    const activeVersion = policy.versions[0] ?? null;
    if (!activeVersion) {
      throw new NotFoundException(`Policy ${policyId} has no active version`);
    }
    const artifacts = await this.prisma.artifact.findMany({
      where: { organizationId: policy.organizationId },
      orderBy: { name: 'asc' },
    });
    const edges = await this.prisma.dependencyEdge.findMany({
      where: { organizationId: policy.organizationId },
      orderBy: [{ sourceNodeId: 'asc' }, { targetNodeId: 'asc' }],
    });
    return {
      policyId: policy.id,
      nodes: [
        ...activeVersion.clauses.map((clause) => ({
          id: clause.id,
          nodeType: 'CLAUSE' as const,
          name: clause.stableKey,
        })),
        ...artifacts.map((artifact) => ({
          id: artifact.id,
          nodeType: 'ARTIFACT' as const,
          name: artifact.name,
          artifactType: artifact.type,
          description: artifact.description,
        })),
      ],
      edges: edges.map((edge) => ({
        id: edge.id,
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
        relationshipType: edge.relationshipType,
        relationshipLabel: relationshipLabel(edge.relationshipType),
        status: edge.status,
        rationale: edge.rationale,
      })),
    };
  }
}
