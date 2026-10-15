import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { DependenciesService } from './dependencies.service.js';
import type { DependencySuggestionService } from '../ai/dependency-suggestion.service.js';

const artifact = { id: 'a1', name: 'Item' };
const edge = { id: 'e1', policyId: 'p1', sourceType: 'CLAUSE', sourceClauseKey: 'KEY', sourceArtifactId: null,
  targetArtifactId: 'a1', relationshipType: 'UPDATES', status: 'APPROVED', origin: 'MANUAL', rationale: null,
  sourceArtifact: null, targetArtifact: artifact };
function setup() {
  const suggestions = { suggest: vi.fn() };
  const prisma = {
    policy: { findUnique: vi.fn() }, clause: { findFirst: vi.fn() },
    policyVersion: { findFirst: vi.fn() },
    artifact: { findUnique: vi.fn(), findMany: vi.fn() },
    dependencyEdge: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  return { service: new DependenciesService(prisma as never, suggestions as unknown as DependencySuggestionService), prisma, suggestions };
}

const clauses = [{ stableKey: 'KEY', title: 'Title', text: 'Text', category: 'category' }];
const items = [
  { id: 'a1', name: 'Item one', type: 'FORM', department: 'Unit', description: null },
  { id: 'a2', name: 'Item two', type: 'PROCEDURE', department: 'Unit', description: null },
];
const clauseSuggestion = (overrides: Record<string, unknown> = {}) => ({ sourceType: 'CLAUSE', sourceClauseKey: 'KEY', sourceArtifactId: null, targetArtifactId: 'a1', relationshipType: 'UPDATES', rationale: null, ...overrides });
function mockSuggestionSetup() {
  const context = setup();
  context.prisma.policy.findUnique.mockResolvedValue({ id: 'p1' });
  context.prisma.policyVersion.findFirst.mockResolvedValue({ id: 'v-draft', clauses });
  context.prisma.artifact.findMany.mockResolvedValue(items);
  context.prisma.dependencyEdge.findMany.mockResolvedValue([]);
  return context;
}
function createdEdge(data: Record<string, unknown>, index: number) {
  const sourceArtifact = data.sourceArtifactId === 'a2' ? items[1] : null;
  const targetArtifact = items.find((item) => item.id === data.targetArtifactId)!;
  return { id: `created-${index}`, policyId: data.policyId, ...data, sourceArtifact, targetArtifact };
}

describe('DependenciesService', () => {
  it('selects draft by default and falls back to active only when there is no draft', async () => {
    const { service, prisma, suggestions } = mockSuggestionSetup();
    suggestions.suggest.mockResolvedValue([]);
    await service.suggest('p1');
    expect(prisma.policyVersion.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.policyVersion.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: { policyId: 'p1', status: 'DRAFT' } }));

    prisma.policyVersion.findFirst.mockReset().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'v-active', clauses });
    await service.suggest('p1');
    expect(prisma.policyVersion.findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { policyId: 'p1', status: 'ACTIVE' } }));
  });

  it('scopes an explicit version to the requested policy and rejects a version from another policy', async () => {
    const { service, prisma, suggestions } = mockSuggestionSetup();
    prisma.policyVersion.findFirst.mockResolvedValue(null);
    await expect(service.suggest('p1', 'other-version')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.policyVersion.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'other-version', policyId: 'p1' } }));
    expect(suggestions.suggest).not.toHaveBeenCalled();
  });

  it('persists valid suggestions as PROPOSED/AI and preserves accepted order and exact public output', async () => {
    const { service, prisma, suggestions } = mockSuggestionSetup();
    const ordered = [clauseSuggestion({ targetArtifactId: 'a2', rationale: 'Second' }), clauseSuggestion({ relationshipType: 'GOVERNS', rationale: 'First' })];
    suggestions.suggest.mockResolvedValue(ordered);
    prisma.dependencyEdge.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => createdEdge(data, prisma.dependencyEdge.create.mock.calls.length));
    const result = await service.suggest('p1');
    expect(prisma.dependencyEdge.create).toHaveBeenCalledTimes(2);
    expect(prisma.dependencyEdge.create.mock.calls.map(([arg]) => arg.data)).toEqual(ordered.map((suggestion) => ({ ...suggestion, policyId: 'p1', status: 'PROPOSED', origin: 'AI' })));
    expect(result).toEqual({ skipped: 0, created: [
      { id: 'created-1', policyId: 'p1', sourceType: 'CLAUSE', sourceClauseKey: 'KEY', sourceArtifactId: null, sourceLabel: 'KEY', targetArtifactId: 'a2', targetLabel: 'Item two', relationshipType: 'UPDATES', status: 'PROPOSED', origin: 'AI', rationale: 'Second' },
      { id: 'created-2', policyId: 'p1', sourceType: 'CLAUSE', sourceClauseKey: 'KEY', sourceArtifactId: null, sourceLabel: 'KEY', targetArtifactId: 'a1', targetLabel: 'Item one', relationshipType: 'GOVERNS', status: 'PROPOSED', origin: 'AI', rationale: 'First' },
    ] });
  });

  it('skips unknown references, self-links, existing and in-batch duplicates while retaining valid suggestion order', async () => {
    const { service, prisma, suggestions } = mockSuggestionSetup();
    const existing = { sourceType: 'CLAUSE', sourceClauseKey: 'KEY', sourceArtifactId: null, targetArtifactId: 'a1', relationshipType: 'UPDATES' };
    prisma.dependencyEdge.findMany.mockResolvedValue([existing]);
    const batch = [
      clauseSuggestion({ sourceClauseKey: 'unknown' }),
      clauseSuggestion({ targetArtifactId: 'missing' }),
      { sourceType: 'ARTIFACT', sourceClauseKey: null, sourceArtifactId: 'missing', targetArtifactId: 'a1', relationshipType: 'UPDATES', rationale: null },
      { sourceType: 'ARTIFACT', sourceClauseKey: null, sourceArtifactId: 'a1', targetArtifactId: 'a1', relationshipType: 'UPDATES', rationale: null },
      clauseSuggestion(),
      clauseSuggestion({ targetArtifactId: 'a2', relationshipType: 'GOVERNS' }),
      clauseSuggestion({ targetArtifactId: 'a2', relationshipType: 'GOVERNS' }),
      clauseSuggestion({ targetArtifactId: 'a2', relationshipType: 'UPDATES' }),
    ];
    suggestions.suggest.mockResolvedValue(batch);
    prisma.dependencyEdge.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => createdEdge(data, prisma.dependencyEdge.create.mock.calls.length));
    const result = await service.suggest('p1');
    expect(result.skipped).toBe(6);
    expect(result.created.map((created) => [created.targetArtifactId, created.relationshipType])).toEqual([['a2', 'GOVERNS'], ['a2', 'UPDATES']]);
    expect(prisma.dependencyEdge.create).toHaveBeenCalledTimes(2);
  });

  it('does not write if the provider suggestion service fails', async () => {
    const { service, prisma, suggestions } = mockSuggestionSetup();
    const failure = new Error('AI_FAILED');
    suggestions.suggest.mockRejectedValue(failure);
    await expect(service.suggest('p1')).rejects.toBe(failure);
    expect(prisma.dependencyEdge.create).not.toHaveBeenCalled();
    expect(prisma.dependencyEdge.createMany).toBeUndefined();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('filters deterministically and maps exactly the public dependency shape', async () => {
    const { service, prisma } = setup();
    prisma.policy.findUnique.mockResolvedValue({ id: 'p1' }); prisma.dependencyEdge.findMany.mockResolvedValue([edge]);
    expect(await service.list('p1', 'APPROVED')).toEqual([{ id: 'e1', policyId: 'p1', sourceType: 'CLAUSE', sourceClauseKey: 'KEY',
      sourceArtifactId: null, sourceLabel: 'KEY', targetArtifactId: 'a1', targetLabel: 'Item', relationshipType: 'UPDATES',
      status: 'APPROVED', origin: 'MANUAL', rationale: null }]);
    expect(prisma.dependencyEdge.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { policyId: 'p1', status: 'APPROVED' }, orderBy: expect.any(Array) }));
  });

  it('creates clause edge by stable key scoped to policy and forces manual approved values', async () => {
    const { service, prisma } = setup();
    prisma.policy.findUnique.mockResolvedValue({ id: 'p1' }); prisma.clause.findFirst.mockResolvedValue({ id: 'row-id' });
    prisma.artifact.findUnique.mockResolvedValue(artifact); prisma.dependencyEdge.findFirst.mockResolvedValue(null); prisma.dependencyEdge.create.mockResolvedValue(edge);
    await service.create('p1', { sourceType: 'CLAUSE', sourceClauseKey: 'KEY', targetArtifactId: 'a1', relationshipType: 'UPDATES' });
    expect(prisma.clause.findFirst).toHaveBeenCalledWith({ where: { stableKey: 'KEY', policyVersion: { policyId: 'p1' } }, select: { id: true } });
    expect(prisma.dependencyEdge.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED', origin: 'MANUAL', sourceClauseKey: 'KEY' }) }));
  });

  it('creates artifact source and rejects self-link or unknown references / policy', async () => {
    const { service, prisma } = setup(); prisma.policy.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.artifact.findUnique.mockResolvedValue(artifact); prisma.dependencyEdge.findFirst.mockResolvedValue(null);
    const input = { sourceType: 'ARTIFACT' as const, sourceArtifactId: 'a2', targetArtifactId: 'a1', relationshipType: 'GOVERNS' as const };
    prisma.dependencyEdge.create.mockResolvedValue({ ...edge, sourceType: 'ARTIFACT', sourceArtifactId: 'a2', sourceClauseKey: null, sourceArtifact: artifact });
    expect((await service.create('p1', input)).sourceLabel).toBe('Item');
    await expect(service.create('p1', { ...input, sourceArtifactId: 'a1' })).rejects.toBeInstanceOf(BadRequestException);
    prisma.policy.findUnique.mockResolvedValue(null);
    await expect(service.create('missing', { sourceType: 'CLAUSE', sourceClauseKey: 'x', targetArtifactId: 'a1', relationshipType: 'UPDATES' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects missing stable key, missing artifact IDs, and duplicate edge', async () => {
    const { service, prisma } = setup(); prisma.policy.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.clause.findFirst.mockResolvedValue(null);
    await expect(service.create('p1', { sourceType: 'CLAUSE', sourceClauseKey: 'row-id', targetArtifactId: 'a1', relationshipType: 'UPDATES' })).rejects.toBeInstanceOf(BadRequestException);
    const artifactInput = { sourceType: 'ARTIFACT' as const, sourceArtifactId: 'a2', targetArtifactId: 'a1', relationshipType: 'GOVERNS' as const };
    prisma.artifact.findUnique.mockResolvedValue(null);
    await expect(service.create('p1', artifactInput)).rejects.toBeInstanceOf(BadRequestException);
    prisma.artifact.findUnique.mockResolvedValue(artifact); prisma.dependencyEdge.findFirst.mockResolvedValue({ id: 'exists' });
    await expect(service.create('p1', { ...artifactInput, sourceArtifactId: 'a2' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('supports human status/rationale edits, prevents relationship duplicates, and rejects empty patch', async () => {
    const { service, prisma } = setup(); prisma.dependencyEdge.findUnique.mockResolvedValue(edge);
    prisma.dependencyEdge.update.mockResolvedValue({ ...edge, status: 'REJECTED', rationale: 'Reviewed' });
    expect((await service.update('e1', { status: 'REJECTED', rationale: 'Reviewed' })).status).toBe('REJECTED');
    prisma.dependencyEdge.update.mockResolvedValue({ ...edge, status: 'APPROVED' });
    expect((await service.update('e1', { status: 'APPROVED' })).status).toBe('APPROVED');
    prisma.dependencyEdge.findFirst.mockResolvedValue({ id: 'other' });
    await expect(service.update('e1', { relationshipType: 'GOVERNS' })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.update('e1', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deletes with no return payload and reports missing dependencies', async () => {
    const { service, prisma } = setup(); prisma.dependencyEdge.delete.mockResolvedValue(edge);
    await expect(service.delete('e1')).resolves.toBeUndefined();
    prisma.dependencyEdge.delete.mockRejectedValue({ name: 'PrismaClientKnownRequestError', code: 'P2025' });
    await expect(service.delete('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
