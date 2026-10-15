import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PolicyGraphEdgeDto, PolicyGraphNodeDto, PolicyGraphDto } from './dto.js';

const versionSelection = {
  id: true,
  clauses: { select: { stableKey: true, title: true, category: true }, orderBy: [{ position: 'asc' }, { stableKey: 'asc' }] },
} satisfies Prisma.PolicyVersionSelect;
const edgeSelection = {
  id: true, sourceType: true, sourceClauseKey: true, sourceArtifactId: true,
  targetArtifactId: true, relationshipType: true, status: true,
} satisfies Prisma.DependencyEdgeSelect;
type Edge = Prisma.DependencyEdgeGetPayload<{ select: typeof edgeSelection }>;
type Artifact = { id: string; name: string; type: string; department: string };

@Injectable()
export class GraphService {
  constructor(private readonly prisma: PrismaService) {}

  async getPolicyGraph(policyId: string, requestedVersionId?: string): Promise<PolicyGraphDto> {
    const policy = await this.prisma.policy.findUnique({ where: { id: policyId }, select: { id: true } });
    if (!policy) throw new NotFoundException('Policy not found');

    const version = requestedVersionId
      ? await this.prisma.policyVersion.findFirst({ where: { id: requestedVersionId, policyId }, select: versionSelection })
      : await this.prisma.policyVersion.findFirst({ where: { policyId, status: 'DRAFT' }, select: versionSelection })
        ?? await this.prisma.policyVersion.findFirst({ where: { policyId, status: 'ACTIVE' }, select: versionSelection });
    if (!version) throw new NotFoundException(requestedVersionId ? 'Version not found' : 'Policy version not found');

    const clauseKeys = new Set(version.clauses.map((clause) => clause.stableKey));
    const rows: Edge[] = await this.prisma.dependencyEdge.findMany({
      where: { policyId, status: { in: ['PROPOSED', 'APPROVED'] } },
      select: edgeSelection,
      orderBy: [{ sourceType: 'asc' }, { sourceClauseKey: 'asc' }, { sourceArtifactId: 'asc' }, { targetArtifactId: 'asc' }, { relationshipType: 'asc' }, { id: 'asc' }],
    });
    const eligible = rows.filter((edge) => edge.status !== 'REJECTED' && (edge.sourceType === 'CLAUSE'
      ? edge.sourceClauseKey !== null && edge.sourceArtifactId === null && clauseKeys.has(edge.sourceClauseKey)
      : edge.sourceType === 'ARTIFACT' && edge.sourceArtifactId !== null && edge.sourceClauseKey === null && edge.sourceArtifactId !== edge.targetArtifactId));
    const artifactIds = [...new Set(eligible.flatMap((edge) => [edge.sourceArtifactId, edge.targetArtifactId]).filter((id): id is string => id !== null))].sort();
    const artifacts: Artifact[] = artifactIds.length
      ? await this.prisma.artifact.findMany({ where: { id: { in: artifactIds } }, select: { id: true, name: true, type: true, department: true } })
      : [];
    const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
    const representable = eligible.filter((edge) => artifactById.has(edge.targetArtifactId)
      && (edge.sourceType === 'CLAUSE' || (edge.sourceArtifactId !== null && artifactById.has(edge.sourceArtifactId))));

    const nodes = new Map<string, PolicyGraphNodeDto>();
    for (const clause of version.clauses) nodes.set(`clause:${clause.stableKey}`, {
      id: `clause:${clause.stableKey}`, type: 'CLAUSE', label: clause.title, subtitle: clause.category,
    });
    for (const edge of representable) {
      for (const id of [edge.sourceArtifactId, edge.targetArtifactId]) {
        if (id === null || nodes.has(`artifact:${id}`)) continue;
        const artifact = artifactById.get(id);
        if (artifact) nodes.set(`artifact:${id}`, { id: `artifact:${id}`, type: 'ARTIFACT', label: artifact.name, subtitle: `${artifact.type} · ${artifact.department}` });
      }
    }
    const edges: PolicyGraphEdgeDto[] = representable.map((edge) => ({
      id: edge.id,
      source: edge.sourceType === 'CLAUSE' ? `clause:${edge.sourceClauseKey}` : `artifact:${edge.sourceArtifactId}`,
      target: `artifact:${edge.targetArtifactId}`,
      relationshipType: edge.relationshipType,
      status: edge.status,
    })).sort((left, right) => left.source.localeCompare(right.source) || left.target.localeCompare(right.target)
      || left.relationshipType.localeCompare(right.relationshipType) || left.id.localeCompare(right.id));
    return { nodes: [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id)), edges };
  }
}
