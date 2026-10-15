import { ConflictException, NotFoundException } from '@nestjs/common';
import { ContractHttpException } from '../common/contract-http.exception.js';
import { vi } from 'vitest';
import { hashClauseText } from './change-classifier.js';
import { PoliciesService } from './policies.service.js';

describe('PoliciesService.createRevision', () => {
  const date = new Date('2026-01-01T00:00:00.000Z');
  const clauses = [
    { id: 'c2', policyVersionId: 'v3', stableKey: 'KEY-2', title: 'Second', text: 'second', category: 'care', position: 2, textHash: 'h2' },
    { id: 'c1', policyVersionId: 'v3', stableKey: 'KEY-1', title: 'First', text: 'first', category: 'safety', position: 1, textHash: 'h1' },
  ];
  const makePolicy = (versions = [
    { id: 'v3', policyId: 'p', versionNumber: 3, status: 'ACTIVE', publishedAt: date, createdAt: date, clauses },
    { id: 'v2', policyId: 'p', versionNumber: 2, status: 'ARCHIVED', publishedAt: date, createdAt: date, clauses: [] },
  ]) => ({ id: 'p', versions });

  function setup(policy: ReturnType<typeof makePolicy> | null, extractionResult = []) {
    let transactionPolicy = policy;
    const findUnique = vi.fn(async () => transactionPolicy);
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const nested = data.clauses as { create: Array<Record<string, unknown>> };
      const created = { id: 'new-version', policyId: 'p', versionNumber: data.versionNumber as number,
        status: 'DRAFT', publishedAt: null, createdAt: date,
        clauses: nested.create.map((clause, index) => ({ id: `new-${index}`, policyVersionId: 'new-version', ...clause })) };
      transactionPolicy = { id: 'p', versions: [...(transactionPolicy?.versions ?? []), { ...created, clauses: created.clauses }] };
      return created;
    });
    const transaction = { policy: { findUnique }, policyVersion: { create } };
    const prisma = { policy: { findUnique }, $transaction: (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction) };
    const extraction = { extract: vi.fn().mockResolvedValue(extractionResult) };
    return { service: new PoliciesService(prisma as never, extraction as never), findUnique, create, extraction };
  }

  it('copies clauses with stable keys, hashes, and ordered contract output using highest+1', async () => {
    const { service, create } = setup(makePolicy());
    await expect(service.createRevision('p', {})).resolves.toMatchObject({
      versionNumber: 4, status: 'DRAFT', publishedAt: null,
      clauses: [
        { versionId: 'new-version', stableKey: 'KEY-1', title: 'First', text: 'first', category: 'safety', position: 1 },
        { versionId: 'new-version', stableKey: 'KEY-2', title: 'Second', text: 'second', category: 'care', position: 2 },
      ],
    });
    expect(create.mock.calls[0][0].data).toMatchObject({ versionNumber: 4, status: 'DRAFT', publishedAt: null,
      clauses: { create: expect.arrayContaining([
        expect.objectContaining({ stableKey: 'KEY-1', textHash: hashClauseText('first') }),
        expect.objectContaining({ stableKey: 'KEY-2', textHash: hashClauseText('second') }),
      ]) } });
  });

  it('re-extracts once with active keys and persists extracted keys with recomputed hashes', async () => {
    const extracted = [{ stableKey: 'KEY-1', title: 'Updated', text: 'changed', category: 'safety', position: 0 }];
    const { service, extraction, create } = setup(makePolicy(), extracted);
    await service.createRevision('p', { text: 'new policy text' });
    expect(extraction.extract).toHaveBeenCalledTimes(1);
    expect(extraction.extract).toHaveBeenCalledWith('new policy text', [
      { stableKey: 'KEY-2', text: 'second' }, { stableKey: 'KEY-1', text: 'first' },
    ]);
    expect(create.mock.calls[0][0].data).toMatchObject({ clauses: { create: [
      { stableKey: 'KEY-1', text: 'changed', textHash: hashClauseText('changed') },
    ] } });
  });

  it('conflicts for an existing draft or missing active version', async () => {
    const withDraft = makePolicy([...makePolicy().versions, { id: 'draft', policyId: 'p', versionNumber: 4,
      status: 'DRAFT', publishedAt: null, createdAt: date, clauses: [] }]);
    await expect(setup(withDraft).service.createRevision('p', {})).rejects.toBeInstanceOf(ConflictException);
    await expect(setup(makePolicy(makePolicy().versions.map((version) => ({ ...version, status: 'ARCHIVED' })))).service.createRevision('p', {}))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('returns not found for missing policy', async () => {
    await expect(setup(null).service.createRevision('missing', {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not open a write transaction when extraction fails', async () => {
    const failure = new ContractHttpException('AI_FAILED', 'AI failed', 502);
    const { service, extraction, create } = setup(makePolicy());
    extraction.extract.mockRejectedValue(failure);
    await expect(service.createRevision('p', { text: 'new text' })).rejects.toBe(failure);
    expect(create).not.toHaveBeenCalled();
  });
});
