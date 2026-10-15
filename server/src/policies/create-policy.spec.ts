import { ContractHttpException } from '../common/contract-http.exception.js';
import { vi } from 'vitest';
import { hashClauseText } from './change-classifier.js';
import { PoliciesService } from './policies.service.js';

describe('PoliciesService.createPolicy', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const extracted = [
    { stableKey: 'KEY-2', title: 'Second', text: 'second clause', category: 'care', position: 2 },
    { stableKey: 'KEY-1', title: 'First', text: 'first clause', category: 'safety', position: 1 },
  ];

  it('extracts once and persists/marshals a draft with the contract fields and hashes', async () => {
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const versionCreate = (data.versions as { create: { clauses: { create: Array<Record<string, unknown>> } } }).create;
      return { id: 'p', title: 'Policy', description: null, versions: [{ id: 'v', policyId: 'p', versionNumber: 1,
        status: 'DRAFT', publishedAt: null, createdAt, clauses: versionCreate.clauses.create.map((clause, index) => ({
          id: `c${index}`, policyVersionId: 'v', ...clause,
        })) }] };
    });
    const extraction = { extract: vi.fn().mockResolvedValue(extracted) };
    const service = new PoliciesService({ policy: { create } } as never, extraction as never);
    await expect(service.createPolicy({ title: 'Policy', text: 'policy source' })).resolves.toEqual({
      policy: { id: 'p', title: 'Policy', description: null, versions: [{ id: 'v', policyId: 'p', versionNumber: 1,
        status: 'DRAFT', publishedAt: null, createdAt: createdAt.toISOString() }] },
      draft: { id: 'v', policyId: 'p', versionNumber: 1, status: 'DRAFT', publishedAt: null, createdAt: createdAt.toISOString(),
        clauses: [
          { id: 'c1', versionId: 'v', stableKey: 'KEY-1', title: 'First', text: 'first clause', category: 'safety', position: 1 },
          { id: 'c0', versionId: 'v', stableKey: 'KEY-2', title: 'Second', text: 'second clause', category: 'care', position: 2 },
        ] },
    });
    expect(extraction.extract).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toMatchObject({ description: null, versions: { create: {
      versionNumber: 1, status: 'DRAFT', publishedAt: null, clauses: { create: expect.arrayContaining([
        expect.objectContaining({ stableKey: 'KEY-1', textHash: hashClauseText('first clause') }),
        expect.objectContaining({ stableKey: 'KEY-2', textHash: hashClauseText('second clause') }),
      ]) },
    } } });
  });

  it('propagates AI_FAILED without issuing a Prisma write', async () => {
    const failure = new ContractHttpException('AI_FAILED', 'AI failed', 502);
    const create = vi.fn();
    const extraction = { extract: vi.fn().mockRejectedValue(failure) };
    const service = new PoliciesService({ policy: { create } } as never, extraction as never);
    await expect(service.createPolicy({ title: 'Policy', text: 'policy source' })).rejects.toBe(failure);
    expect(create).not.toHaveBeenCalled();
  });
});
