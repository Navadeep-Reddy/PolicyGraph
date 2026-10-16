import { ConflictException, NotFoundException } from '@nestjs/common';
import { vi } from 'vitest';
import { PoliciesService } from './policies.service.js';

describe('PoliciesService.publishVersion', () => {
  const now = new Date('2026-05-01T12:00:00.000Z');
  const clauses = [
    { id: 'later', policyVersionId: 'draft', stableKey: 'B', title: 'B', text: 'b', category: 'test', position: 2, textHash: 'private' },
    { id: 'earlier', policyVersionId: 'draft', stableKey: 'A', title: 'A', text: 'a', category: 'test', position: 1, textHash: 'private' },
  ];

  function setup(status: string | null = 'DRAFT', clauseRows = clauses, previous = false, failUpdate = false) {
    const operations: string[] = [];
    const version = status === null ? null : {
      id: 'draft', policyId: 'policy', versionNumber: 2, status, publishedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'), clauses: clauseRows,
    };
    const findUnique = vi.fn(async () => { operations.push('read'); return version; });
    const updateMany = vi.fn(async () => { operations.push('archive'); return { count: previous ? 1 : 0 }; });
    const update = vi.fn(async ({ data }: { data: { status: string; publishedAt: Date } }) => {
      operations.push('publish');
      if (failUpdate) throw new Error('update failed');
      return { ...version!, ...data };
    });
    const tx = { policyVersion: { findUnique, updateMany, update } };
    const $transaction = vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>, _options?: { maxWait: number; timeout: number }) => callback(tx));
    return { service: new PoliciesService({ $transaction } as never), operations, findUnique, updateMany, update, $transaction };
  }

  it('publishes a first version with ordered contract clauses and one published timestamp', async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const { service, operations, updateMany, update, $transaction } = setup();
    await expect(service.publishVersion('draft')).resolves.toEqual({
      id: 'draft', policyId: 'policy', versionNumber: 2, status: 'ACTIVE',
      publishedAt: now.toISOString(), createdAt: '2026-01-01T00:00:00.000Z',
      clauses: [
        { id: 'earlier', versionId: 'draft', stableKey: 'A', title: 'A', text: 'a', category: 'test', position: 1 },
        { id: 'later', versionId: 'draft', stableKey: 'B', title: 'B', text: 'b', category: 'test', position: 2 },
      ],
    });
    expect(operations).toEqual(['read', 'archive', 'publish']);
    expect($transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 10_000, timeout: 15_000 });
    expect(updateMany).toHaveBeenCalledWith({ where: { policyId: 'policy', status: 'ACTIVE' }, data: { status: 'ARCHIVED' } });
    expect(update.mock.calls[0][0].data.publishedAt.getTime()).toBe(now.getTime());
    vi.useRealTimers();
  });

  it('archives the previous ACTIVE version before activating the target', async () => {
    const { service, updateMany, operations } = setup('DRAFT', clauses, true);
    await service.publishVersion('draft');
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(operations).toEqual(['read', 'archive', 'publish']);
  });

  it('returns not found for a missing version', async () => {
    const { service, updateMany } = setup(null);
    await expect(service.publishVersion('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects non-draft versions and empty drafts', async () => {
    await expect(setup('ACTIVE').service.publishVersion('draft')).rejects.toBeInstanceOf(ConflictException);
    const empty = setup('DRAFT', []);
    await expect(empty.service.publishVersion('draft')).rejects.toBeInstanceOf(ConflictException);
    expect(empty.updateMany).not.toHaveBeenCalled();
  });

  it('lets transactional callback failure abort archive and publish operations', async () => {
    const { service, updateMany, update, $transaction } = setup('DRAFT', clauses, true, true);
    await expect(service.publishVersion('draft')).rejects.toThrow('update failed');
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect($transaction).toHaveBeenCalledTimes(1);
  });

  it('propagates transaction failure without returning a published version', async () => {
    const failure = Object.assign(new Error('transaction failed'), { code: 'P2028' });
    const $transaction = vi.fn(async () => { throw failure; });
    const service = new PoliciesService({ $transaction } as never);

    await expect(service.publishVersion('draft')).rejects.toBe(failure);
    expect($transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 10_000, timeout: 15_000 });
  });
});
