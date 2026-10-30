import { ConflictException } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PoliciesService } from './policies.service.js';
import { VersionChangesQueryDto } from './dto.js';

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
    const service = new PoliciesService({ $queryRaw: async () => [] } as never);
    await expect(service.listPolicies()).resolves.toEqual([]);
  });

  it('maps summary fields and latest approved policy data', async () => {
    const policy = { id: 'p', title: 'Policy', description: null, updatedAt: date,
      activeVersionNumber: 1, activeVersionId: 'v1', draftVersionId: 'v2', approvedDependencyCount: 3, latestImpactRunId: 'run' };
    let calls = 0;
    const service = new PoliciesService({
      $queryRaw: async () => { calls++; return [policy]; },
    } as never);
    await expect(service.listPolicies()).resolves.toEqual([{
      id: 'p', title: 'Policy', description: null, activeVersionNumber: 1,
      draftVersionId: 'v2', activeVersionId: 'v1', approvedDependencyCount: 3,
      latestImpactRunId: 'run', updatedAt: date.toISOString(),
    }]);
    expect(calls).toBe(1);
  });

  it('preserves nullable version and impact fields for unpublished policies in one round trip', async () => {
    let calls = 0;
    const policies = Array.from({ length: 20 }, (_, index) => ({
      id: `p-${index}`, title: `Policy ${index}`, description: null, updatedAt: date,
      activeVersionNumber: null, activeVersionId: null, draftVersionId: `draft-${index}`,
      approvedDependencyCount: 0, latestImpactRunId: null,
    }));
    const service = new PoliciesService({ $queryRaw: async () => { calls++; return policies; } } as never);
    expect(await service.listPolicies()).toEqual(policies.map((policy) => ({ ...policy, updatedAt: date.toISOString() })));
    expect(calls).toBe(1);
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

describe('PoliciesService.getChanges', () => {
  const clause = (version: string, stableKey: string, position: number, textHash: string) => ({
    id: `${version}-${stableKey}`, policyVersionId: version, stableKey, title: stableKey,
    text: `${stableKey}-${version}`, category: 'policy', position, textHash,
  });
  const base = { id: 'base', policyId: 'p', versionNumber: 1, clauses: [
    clause('base', 'modified', 0, 'old'), clause('base', 'removed', 1, 'gone'), clause('base', 'same', 2, 'same'),
  ] };
  const target = { id: 'target', policyId: 'p', versionNumber: 2, clauses: [
    clause('target', 'added', 0, 'new'), clause('target', 'modified', 1, 'new'), clause('target', 'same', 2, 'same'),
  ] };
  it('compares explicitly against a version ID, preserving classifier order and exact clause DTOs', async () => {
    const prisma = { policyVersion: { findUnique: async () => target, findFirst: async () => base } };
    const changes = await new PoliciesService(prisma as never).getChanges('target', 'base');
    expect(changes.map(({ stableKey, changeType }) => [stableKey, changeType])).toEqual([
      ['added', 'ADDED'], ['modified', 'MODIFIED'], ['same', 'UNCHANGED'], ['removed', 'REMOVED'],
    ]);
    expect(changes[0]).toEqual({ stableKey: 'added', changeType: 'ADDED', before: null, after: {
      id: 'target-added', versionId: 'target', stableKey: 'added', title: 'added', text: 'added-target', category: 'policy', position: 0,
    } });
    expect(changes[1].before).toMatchObject({ versionId: 'base', text: 'modified-base' });
    expect(changes[1].after).toMatchObject({ versionId: 'target', text: 'modified-target' });
    expect(changes[3]).toEqual({ stableKey: 'removed', changeType: 'REMOVED', before: {
      id: 'base-removed', versionId: 'base', stableKey: 'removed', title: 'removed', text: 'removed-base', category: 'policy', position: 1,
    }, after: null });
    expect(JSON.stringify(changes)).not.toContain('textHash');
  });
  it('defaults to the immediately preceding version number', async () => {
    let query: unknown;
    const prisma = { policyVersion: { findUnique: async () => target, findFirst: async (args: unknown) => { query = args; return base; } } };
    await new PoliciesService(prisma as never).getChanges('target');
    expect(query).toEqual({ where: { policyId: 'p', versionNumber: 1 }, include: { clauses: true } });
  });
  it('scopes requested base IDs to the target policy', async () => {
    let query: unknown;
    const prisma = { policyVersion: { findUnique: async () => target, findFirst: async (args: unknown) => { query = args; return null; } } };
    await expect(new PoliciesService(prisma as never).getChanges('target', 'foreign-base')).rejects.toBeInstanceOf(NotFoundException);
    expect(query).toEqual({ where: { id: 'foreign-base', policyId: 'p' }, include: { clauses: true } });
  });
  it('returns not found for missing target or explicitly requested base', async () => {
    const missingTarget = new PoliciesService({ policyVersion: { findUnique: async () => null } } as never);
    await expect(missingTarget.getChanges('missing')).rejects.toBeInstanceOf(NotFoundException);
    const missingBase = new PoliciesService({ policyVersion: { findUnique: async () => target, findFirst: async () => null } } as never);
    await expect(missingBase.getChanges('target', 'missing-base')).rejects.toBeInstanceOf(NotFoundException);
  });
  it('returns NO_BASE_VERSION when no previous version exists', async () => {
    const service = new PoliciesService({ policyVersion: { findUnique: async () => ({ ...target, versionNumber: 1 }), findFirst: async () => null } } as never);
    await expect(service.getChanges('target')).rejects.toMatchObject({ code: 'NO_BASE_VERSION' });
  });
});

describe('VersionChangesQueryDto', () => {
  it.each(['', '   ', 2, false])('rejects invalid against value %s', async (against) => {
    const query = plainToInstance(VersionChangesQueryDto, { against });
    expect(await validate(query)).not.toHaveLength(0);
  });
  it('accepts a version ID string', async () => {
    const query = plainToInstance(VersionChangesQueryDto, { against: 'base-version-id' });
    expect(await validate(query)).toHaveLength(0);
    expect(query.against).toBe('base-version-id');
  });
});
