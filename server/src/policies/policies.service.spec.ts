import { ConflictException } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { PoliciesService } from './policies.service.js';

describe('PoliciesService.updateClause', () => {
  function createService(version: { id: string; status: string } | null) {
    const clauseRow = {
      id: 'clause-1',
      policyVersionId: 'version-1',
      stableKey: 'TRAVEL-CLAIM-DEADLINE', title: 'Title', category: 'test',
      text: 'old text',
      position: 0,
      textHash: 'old-hash',
    };
    const prisma = {
      policyVersion: {
        findUnique: async () => version,
      },
      clause: {
        findFirst: async () => (version ? clauseRow : null),
        update: async ({ data }: { data: { text?: string; title?: string; category?: string; textHash: string } }) => ({
          ...clauseRow,
          ...data,
          textHash: data.textHash,
        }),
      },
    };
    // PrismaService is a thin wrapper; a structural stub is sufficient here.
    const service = new PoliciesService(prisma as never);
    return service;
  }

  it('rejects edits when the owning version is not DRAFT', async () => {
    const service = createService({ id: 'version-1', status: 'ACTIVE' });
    await expect(service.updateClause('version-1', 'clause-1', { text: 'new text' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('allows edits when the owning version is DRAFT', async () => {
    const service = createService({ id: 'version-1', status: 'DRAFT' });
    const updated = await service.updateClause('version-1', 'clause-1', { text: 'new text' });
    expect(updated.text).toBe('new text');
  });
});

describe('draft clause mutations', () => {
  const version = { id: 'v', status: 'DRAFT' };
  const input = { stableKey: 'K', title: 'Title', text: 'Text', category: 'test' };
  it('appends clauses, hashes text, and returns contract shape', async () => {
    const prisma = { policyVersion: { findUnique: async () => ({ ...version, clauses: [{ position: 3 }] }) }, clause: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: 'c', policyVersionId: 'v', position: 4, ...data }),
    } };
    const result = await new PoliciesService(prisma as never).createClause('v', input);
    expect(result).toEqual({ id: 'c', versionId: 'v', stableKey: 'K', title: 'Title', text: 'Text', category: 'test', position: 4 });
  });
  it('maps duplicate precheck and Prisma unique race to conflict', async () => {
    const precheck = new PoliciesService({ policyVersion: { findUnique: async () => ({ ...version, clauses: [{ stableKey: 'K' }] }) } } as never);
    await expect(precheck.createClause('v', input)).rejects.toBeInstanceOf(ConflictException);
    const race = new PoliciesService({ policyVersion: { findUnique: async () => ({ ...version, clauses: [] }) }, clause: { create: async () => { throw { code: 'P2002' }; } } } as never);
    await expect(race.createClause('v', input)).rejects.toBeInstanceOf(ConflictException);
  });
  it('patches partial fields, hashes resulting text, and checks ownership', async () => {
    const clause = { id: 'c', policyVersionId: 'v', stableKey: 'K', title: 'Old', text: 'Text', category: 'old', position: 0 };
    let data: Record<string, unknown> = {};
    const service = new PoliciesService({ policyVersion: { findUnique: async () => version }, clause: {
      findFirst: async ({ where }: { where: { policyVersionId: string } }) => where.policyVersionId === 'v' ? clause : null,
      update: async (args: { data: Record<string, unknown> }) => { data = args.data; return { ...clause, ...data }; },
    } } as never);
    expect(await service.updateClause('v', 'c', { title: 'New' })).toMatchObject({ title: 'New', versionId: 'v' });
    expect(data.textHash).toBe((await import('./change-classifier.js')).hashClauseText('Text'));
    await expect(service.updateClause('other', 'c', { title: 'New' })).rejects.toBeInstanceOf(NotFoundException);
  });
  it('rejects empty patch and deletes only after draft/ownership checks', async () => {
    const service = new PoliciesService({ policyVersion: { findUnique: async () => version }, clause: {
      findFirst: async () => ({ id: 'c' }), delete: async () => undefined,
    } } as never);
    await expect(service.updateClause('v', 'c', {})).rejects.toThrow();
    await expect(service.deleteClause('v', 'c')).resolves.toBeUndefined();
    const missing = new PoliciesService({ policyVersion: { findUnique: async () => null } } as never);
    await expect(missing.deleteClause('v', 'c')).rejects.toBeInstanceOf(NotFoundException);
    const active = new PoliciesService({ policyVersion: { findUnique: async () => ({ id: 'v', status: 'ACTIVE' }) } } as never);
    await expect(active.createClause('v', input)).rejects.toBeInstanceOf(ConflictException);
    await expect(active.updateClause('v', 'c', { title: 'x' })).rejects.toBeInstanceOf(ConflictException);
    await expect(active.deleteClause('v', 'c')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('PoliciesService contract reads', () => {
  const date = new Date('2026-01-01T00:00:00.000Z');
  it('maps empty policy list', async () => {
    const service = new PoliciesService({ policy: { findMany: async () => [] } } as never);
    await expect(service.listPolicies()).resolves.toEqual([]);
  });

  it('maps summary fields and latest approved policy data', async () => {
    const policy = { id: 'p', title: 'Policy', description: null, updatedAt: date,
      versions: [{ id: 'v1', versionNumber: 1, status: 'ACTIVE' }, { id: 'v2', versionNumber: 2, status: 'DRAFT' }] };
    const service = new PoliciesService({
      policy: { findMany: async () => [policy] },
      dependencyEdge: { count: async () => 3 },
      impactRun: { findFirst: async () => ({ id: 'run' }) },
    } as never);
    await expect(service.listPolicies()).resolves.toEqual([{
      id: 'p', title: 'Policy', description: null, activeVersionNumber: 1,
      draftVersionId: 'v2', activeVersionId: 'v1', approvedDependencyCount: 3,
      latestImpactRunId: 'run', updatedAt: date.toISOString(),
    }]);
  });

  it('returns newest-first policy versions without internal fields', async () => {
    const makeVersion = (id: string, versionNumber: number) => ({ id, policyId: 'p', versionNumber,
      status: 'ARCHIVED', publishedAt: null, createdAt: date, textHash: 'private' });
    const service = new PoliciesService({ policy: { findUnique: async () => ({
      id: 'p', title: 'Policy', description: null,
      versions: [makeVersion('v2', 2), makeVersion('v1', 1)],
    }) } } as never);
    await expect(service.getPolicy('p')).resolves.toEqual({ id: 'p', title: 'Policy', description: null, versions: [
      { id: 'v2', policyId: 'p', versionNumber: 2, status: 'ARCHIVED', publishedAt: null, createdAt: date.toISOString() },
      { id: 'v1', policyId: 'p', versionNumber: 1, status: 'ARCHIVED', publishedAt: null, createdAt: date.toISOString() },
    ] });
  });

  it('returns ordered contract clauses without text hashes', async () => {
    const clause = (id: string, position: number) => ({ id, policyVersionId: 'v', stableKey: id,
      title: id, text: id, category: 'test', position, textHash: 'private' });
    const service = new PoliciesService({ policyVersion: { findUnique: async () => ({
      id: 'v', policyId: 'p', versionNumber: 1, status: 'DRAFT', publishedAt: null, createdAt: date,
      clauses: [clause('second', 2), clause('first', 1)],
    }) } } as never);
    await expect(service.getVersion('v')).resolves.toEqual({
      id: 'v', policyId: 'p', versionNumber: 1, status: 'DRAFT', publishedAt: null,
      createdAt: date.toISOString(), clauses: [
        { id: 'first', versionId: 'v', stableKey: 'first', title: 'first', text: 'first', category: 'test', position: 1 },
        { id: 'second', versionId: 'v', stableKey: 'second', title: 'second', text: 'second', category: 'test', position: 2 },
      ],
    });
  });

  it('returns not found for missing policy and version', async () => {
    const service = new PoliciesService({
      policy: { findUnique: async () => null },
      policyVersion: { findUnique: async () => null },
    } as never);
    await expect(service.getPolicy('missing')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getVersion('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
