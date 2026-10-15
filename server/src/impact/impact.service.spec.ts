import { HttpStatus } from '@nestjs/common';
import { vi } from 'vitest';
import { ImpactService } from './impact.service.js';
import { UpdateReviewDto } from './dto.js';
import { validate } from 'class-validator';

const clause = (id: string, stableKey: string, textHash: string, text = stableKey, position = 0) => ({ id, policyVersionId: id.startsWith('base') ? 'base' : 'target', stableKey, textHash, text, position, title: stableKey, category: 'policy' });
const artifact = (id: string, name = id) => ({ id, name, type: 'FORM' as const, department: 'Ward', description: null, content: null });
const edge = (id: string, sourceType: 'CLAUSE' | 'ARTIFACT', sourceClauseKey: string | null, sourceArtifactId: string | null, targetArtifactId: string, status = 'APPROVED', policyId = 'p') => ({ id, policyId, sourceType, sourceClauseKey, sourceArtifactId, targetArtifactId, relationshipType: 'UPDATES', status, rationale: null });

function setup({ targetClauses = [clause('target1', 'K', 'new')], baseClauses = [clause('base1', 'K', 'old')], edges = [edge('e1', 'CLAUSE', 'K', null, 'a'), edge('e2', 'ARTIFACT', null, 'a', 'b')], artifacts = [artifact('a', 'Alpha'), artifact('b', 'Beta')], base = true } = {}) {
  const writes: unknown[] = [];
  const runs = new Map<string, any>();
  const prisma: any = {
    policyVersion: {
      findUnique: vi.fn(async ({ where }: any) => where.id === 'target' ? { id: 'target', policyId: 'p', versionNumber: 3, policy: { id: 'p', title: 'Policy' }, clauses: targetClauses } : where.id === 'base' ? { id: 'base', policyId: 'p', clauses: baseClauses } : null),
      findFirst: vi.fn(async () => base ? { id: 'base', policyId: 'p', versionNumber: 2, clauses: baseClauses } : null),
    },
    dependencyEdge: { findMany: vi.fn(async ({ where }: any) => edges.filter((item) => item.policyId === where.policyId)) },
    artifact: { findMany: vi.fn(async () => artifacts) },
    impactRun: {
      create: vi.fn(async ({ data }: any) => { writes.push(data); const run = { id: 'run', ...data, createdAt: new Date('2026-01-01T00:00:00Z') }; runs.set('run', run); return run; }),
      findUnique: vi.fn(async () => { const run = runs.get('run'); return run ? { ...run, policyVersion: { id: 'target', policyId: 'p', policy: { title: 'Policy' }, clauses: targetClauses }, results: (runs.get('results') ?? []) } : null; }),
      findMany: vi.fn(async () => [{ id: 'new', createdAt: new Date('2026-02-01'), _count: { results: 2 } }, { id: 'old', createdAt: new Date('2026-01-01'), _count: { results: 1 } }]),
    },
    impactResult: {
      createMany: vi.fn(async ({ data }: any) => { writes.push(data); runs.set('results', data.map((item: any, index: number) => ({ id: `r${index}`, reviewComment: null, ...item, artifact: artifacts.find((a) => a.id === item.artifactId) }))); }),
      findUnique: vi.fn(async ({ where }: any) => (runs.get('results') ?? []).find((item: any) => item.id === where.id) ?? null),
      update: vi.fn(async ({ where, data, include }: any) => {
        writes.push({ where, data, include });
        const result = (runs.get('results') ?? []).find((item: any) => item.id === where.id);
        return { ...result, ...data, artifact: artifacts.find((item) => item.id === result.artifactId) };
      }),
    },
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
  };
  return { service: new ImpactService(prisma), prisma, writes };
}

describe('ImpactService B-20 orchestration', () => {
  it('persists complete direct and indirect paths, contract reasons and default review state atomically', async () => {
    const { service, prisma, writes } = setup();
    const report = await service.createImpactRun('target');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(writes[0]).toEqual({ policyVersionId: 'target', baseVersionId: 'base' });
    const saved = writes[1] as any[];
    expect(saved.map((item) => [item.artifactId, item.distance, item.reviewStatus])).toEqual([['a', 1, 'PROPOSED'], ['b', 2, 'PROPOSED']]);
    expect(saved[1].pathJson).toEqual({ nodes: [{ id: 'clause:K', type: 'CLAUSE', label: 'K' }, { id: 'artifact:a', type: 'ARTIFACT', label: 'Alpha' }, { id: 'artifact:b', type: 'ARTIFACT', label: 'Beta' }], edges: [{ id: 'e1', relationshipType: 'UPDATES' }, { id: 'e2', relationshipType: 'UPDATES' }] });
    expect(saved[1].reason).toBe('MODIFIED clause "K" affects operational item "Beta" via "K" --UPDATES--> "Alpha"; then "Alpha" --UPDATES--> "Beta".');
    expect(report.results[1]?.path.nodes[0]).toEqual({ id: 'clause:K', type: 'CLAUSE', label: 'K' });
  });

  it('persists one result per artifact and changed clause while ignoring non-approved and other-policy edges', async () => {
    const changes = [clause('base1', 'K', 'old'), clause('base2', 'J', 'old')];
    const targets = [clause('target1', 'K', 'new'), clause('target2', 'J', 'new')];
    const { service, writes } = setup({ baseClauses: changes, targetClauses: targets, edges: [edge('k', 'CLAUSE', 'K', null, 'a'), edge('j', 'CLAUSE', 'J', null, 'a'), edge('p', 'CLAUSE', 'K', null, 'b', 'PROPOSED'), edge('wrong-policy', 'CLAUSE', 'K', null, 'b', 'APPROVED', 'other')] });
    await service.createImpactRun('target');
    expect((writes[1] as any[]).map(({ changedClauseKey, artifactId }) => [changedClauseKey, artifactId])).toEqual([['J', 'a'], ['K', 'a']]);
  });

  it('resolves the immediate prior version and reports no base or missing target/run', async () => {
    const { service, prisma } = setup({ base: false });
    await expect(service.createImpactRun('target')).rejects.toMatchObject({ code: 'NO_BASE_VERSION', status: HttpStatus.CONFLICT });
    expect(prisma.policyVersion.findFirst).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { versionNumber: 'desc' }, where: { policyId: 'p', versionNumber: { lt: 3 } } }));
    await expect(service.createImpactRun('absent')).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    await expect(service.getImpactRun('absent')).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
  });

  it('persists completed empty runs for no starts and disconnected graphs', async () => {
    const unchanged = setup({ targetClauses: [clause('target1', 'K', 'same')], baseClauses: [clause('base1', 'K', 'same')] });
    expect((await unchanged.service.createImpactRun('target')).results).toEqual([]);
    expect(unchanged.prisma.impactRun.create).toHaveBeenCalledTimes(1);
    const disconnected = setup({ edges: [], artifacts: [] });
    expect((await disconnected.service.createImpactRun('target')).results).toEqual([]);
    expect(disconnected.prisma.impactResult.createMany).not.toHaveBeenCalled();
  });

  it('returns contract report fields only and reconstructs persisted report without rerunning BFS or writes', async () => {
    const { service, prisma } = setup();
    await service.createImpactRun('target');
    const report = await service.getImpactRun('run');
    expect(Object.keys(report)).toEqual(['id', 'policyId', 'policyTitle', 'versionId', 'baseVersionId', 'createdAt', 'changedClauses', 'affectedDepartments', 'results']);
    expect(report.changedClauses).toEqual([{ stableKey: 'K', changeType: 'MODIFIED', oldText: 'K', newText: 'K' }]);
    expect(report.results[0]).toMatchObject({ changedClauseKey: 'K', reviewStatus: 'PROPOSED', path: { nodes: expect.any(Array), edges: expect.any(Array) } });
    expect(JSON.stringify(report)).not.toMatch(/textHash|policyVersionId|pathJson|content|description/);
    expect(prisma.impactRun.create).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed persisted paths with a deterministic server error', async () => {
    const { service, prisma } = setup();
    await service.createImpactRun('target');
    prisma.impactRun.findUnique.mockImplementation(async () => ({ id: 'run', baseVersionId: 'base', policyVersionId: 'target', policyVersion: { id: 'target', policyId: 'p', policy: { title: 'Policy' }, clauses: [] }, results: [{ id: 'broken', distance: 1, pathJson: {}, reason: 'stored', reviewStatus: 'PROPOSED', reviewComment: null, changedClauseKey: 'K', artifact: artifact('a') }] }));
    await expect(service.getImpactRun('run')).rejects.toMatchObject({ status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Persisted impact path is corrupt' });
  });

  it('returns the exact newest-first version run list shape', async () => {
    const { service, prisma } = setup();
    expect(await service.listImpactRuns('target')).toEqual([{ id: 'new', createdAt: '2026-02-01T00:00:00.000Z', resultCount: 2 }, { id: 'old', createdAt: '2026-01-01T00:00:00.000Z', resultCount: 1 }]);
    expect(prisma.impactRun.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { createdAt: 'desc' } }));
  });

  it.each(['PROPOSED', 'CONFIRMED', 'DISMISSED', 'RESOLVED'] as const)(
    'updates review status %s and only supplied human review fields', async (reviewStatus) => {
      const { service, prisma, writes } = setup();
      await service.createImpactRun('target');
      const before = writes[1];
      const result = await service.updateImpactResult('r0', reviewStatus, 'Reviewed');
      expect(prisma.impactResult.update).toHaveBeenCalledWith({ where: { id: 'r0' }, data: { reviewStatus, reviewComment: 'Reviewed' }, include: { artifact: true } });
      expect(result).toEqual({ id: 'r0', changedClauseKey: 'K', artifact: { id: 'a', name: 'Alpha', type: 'FORM', department: 'Ward' }, distance: 1, reason: expect.any(String), reviewStatus, reviewComment: 'Reviewed', path: { nodes: expect.any(Array), edges: expect.any(Array) } });
      expect(Object.keys(result)).toEqual(['id', 'changedClauseKey', 'artifact', 'distance', 'reason', 'reviewStatus', 'reviewComment', 'path']);
      expect(writes[1]).toBe(before);
      expect(prisma.impactRun.create).toHaveBeenCalledTimes(1);
      expect(prisma.dependencyEdge.findMany).toHaveBeenCalledTimes(1);
    },
  );

  it('preserves omitted comment, returns not found, and validates the exact request body', async () => {
    const { service, prisma } = setup();
    await service.createImpactRun('target');
    const result = await service.updateImpactResult('r0', 'CONFIRMED');
    expect(prisma.impactResult.update).toHaveBeenCalledWith({ where: { id: 'r0' }, data: { reviewStatus: 'CONFIRMED' }, include: { artifact: true } });
    expect(result.reviewComment).toBeNull();
    await expect(service.updateImpactResult('missing', 'CONFIRMED')).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    expect(await validate(Object.assign(new UpdateReviewDto(), { reviewStatus: 'CONFIRMED' }), { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
    for (const body of [{ reviewStatus: 'NOPE' }, { reviewStatus: 'CONFIRMED', reviewComment: null }, { reviewStatus: 'CONFIRMED', extra: true }]) {
      const dto = Object.assign(new UpdateReviewDto(), body);
      expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).not.toHaveLength(0);
    }
    expect(await validate(new UpdateReviewDto(), { whitelist: true, forbidNonWhitelisted: true })).not.toHaveLength(0);
    const malformed = prisma.impactResult.findUnique;
    malformed.mockResolvedValueOnce({ id: 'broken', pathJson: {}, reviewComment: null });
    prisma.impactResult.update.mockResolvedValueOnce({ id: 'broken', changedClauseKey: 'K', distance: 1, pathJson: {}, reason: 'stored', reviewStatus: 'RESOLVED', reviewComment: null, artifact: artifact('a') });
    await expect(service.updateImpactResult('broken', 'RESOLVED')).rejects.toMatchObject({ status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Persisted impact path is corrupt' });
  });
});
