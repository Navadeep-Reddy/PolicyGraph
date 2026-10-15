import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { GraphService } from './graph.service.js';

function setup() {
  const prisma = {
    policy: { findUnique: vi.fn() },
    policyVersion: { findFirst: vi.fn() },
    dependencyEdge: { findMany: vi.fn() },
    artifact: { findMany: vi.fn() },
  };
  return { service: new GraphService(prisma as never), prisma };
}
const clause = { stableKey: 'K', title: 'Clause title', category: 'safety' };
const edge = (id: string, sourceType: string, sourceClauseKey: string | null, sourceArtifactId: string | null, targetArtifactId: string, status = 'APPROVED') => ({
  id, sourceType, sourceClauseKey, sourceArtifactId, targetArtifactId, relationshipType: 'UPDATES', status,
});
const artifacts = [
  { id: 'a', name: 'Alpha', type: 'FORM', department: 'Unit' },
  { id: 'b', name: 'Beta', type: 'PROCEDURE', department: 'Ward' },
];

describe('GraphService', () => {
  it('chooses requested version or defaults to draft then active', async () => {
    const { service, prisma } = setup();
    prisma.policy.findUnique.mockResolvedValue({ id: 'p' });
    prisma.policyVersion.findFirst.mockResolvedValue({ id: 'selected', clauses: [clause] });
    prisma.dependencyEdge.findMany.mockResolvedValue([]);
    await service.getPolicyGraph('p', 'explicit');
    expect(prisma.policyVersion.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: 'explicit', policyId: 'p' } }));
    prisma.policyVersion.findFirst.mockReset().mockResolvedValueOnce({ id: 'draft', clauses: [] });
    await service.getPolicyGraph('p');
    expect(prisma.policyVersion.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.policyVersion.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { policyId: 'p', status: 'DRAFT' } }));
    prisma.policyVersion.findFirst.mockReset().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'active', clauses: [] });
    await service.getPolicyGraph('p');
    expect(prisma.policyVersion.findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { policyId: 'p', status: 'ACTIVE' } }));
  });

  it('builds canonical clause and artifact nodes and maps valid edges in direction/order with exact contract fields', async () => {
    const { service, prisma } = setup();
    prisma.policy.findUnique.mockResolvedValue({ id: 'p' });
    prisma.policyVersion.findFirst.mockResolvedValue({ id: 'v', clauses: [{ ...clause, stableKey: 'Z' }, clause] });
    prisma.dependencyEdge.findMany.mockResolvedValue([
      edge('z', 'CLAUSE', 'K', null, 'a', 'PROPOSED'), edge('b', 'ARTIFACT', null, 'a', 'b'),
      edge('a', 'CLAUSE', 'K', null, 'a'), edge('rejected', 'CLAUSE', 'K', null, 'b', 'REJECTED'),
    ]);
    prisma.artifact.findMany.mockResolvedValue(artifacts);
    const graph = await service.getPolicyGraph('p');
    expect(graph).toEqual({
      nodes: [
        { id: 'artifact:a', type: 'ARTIFACT', label: 'Alpha', subtitle: 'FORM · Unit' },
        { id: 'artifact:b', type: 'ARTIFACT', label: 'Beta', subtitle: 'PROCEDURE · Ward' },
        { id: 'clause:K', type: 'CLAUSE', label: 'Clause title', subtitle: 'safety' },
        { id: 'clause:Z', type: 'CLAUSE', label: 'Clause title', subtitle: 'safety' },
      ],
      edges: [
        { id: 'b', source: 'artifact:a', target: 'artifact:b', relationshipType: 'UPDATES', status: 'APPROVED' },
        { id: 'a', source: 'clause:K', target: 'artifact:a', relationshipType: 'UPDATES', status: 'APPROVED' },
        { id: 'z', source: 'clause:K', target: 'artifact:a', relationshipType: 'UPDATES', status: 'PROPOSED' },
      ],
    });
    expect(prisma.artifact.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['a', 'b'] } } }));
  });

  it('scopes policy and explicit version, excludes stale clause keys and missing artifacts, and returns an empty graph', async () => {
    const { service, prisma } = setup();
    prisma.policy.findUnique.mockResolvedValue({ id: 'p' });
    prisma.policyVersion.findFirst.mockResolvedValue({ id: 'v', clauses: [clause] });
    prisma.dependencyEdge.findMany.mockResolvedValue([edge('stale', 'CLAUSE', 'old', null, 'a'), edge('missing', 'ARTIFACT', null, 'gone', 'a')]);
    prisma.artifact.findMany.mockResolvedValue([]);
    expect(await service.getPolicyGraph('p', 'v')).toEqual({ nodes: [{ id: 'clause:K', type: 'CLAUSE', label: 'Clause title', subtitle: 'safety' }], edges: [] });
    expect(prisma.dependencyEdge.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { policyId: 'p', status: { in: ['PROPOSED', 'APPROVED'] } } }));
    prisma.policy.findUnique.mockResolvedValue(null);
    await expect(service.getPolicyGraph('missing')).rejects.toBeInstanceOf(NotFoundException);
    prisma.policy.findUnique.mockResolvedValue({ id: 'p' });
    prisma.policyVersion.findFirst.mockResolvedValue(null);
    await expect(service.getPolicyGraph('p', 'other')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.policyVersion.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: 'other', policyId: 'p' } }));
  });
});
