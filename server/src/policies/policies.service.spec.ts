import { BadRequestException } from '@nestjs/common';
import { PoliciesService } from './policies.service.js';

describe('PoliciesService.updateClause', () => {
  function createService(version: { id: string; status: string } | null) {
    const clauseRow = {
      id: 'clause-1',
      policyVersionId: 'version-1',
      stableKey: 'TRAVEL-CLAIM-DEADLINE',
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
        update: async ({ data }: { data: { text: string; textHash: string } }) => ({
          ...clauseRow,
          text: data.text,
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
    await expect(service.updateClause('version-1', 'clause-1', 'new text')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('allows edits when the owning version is DRAFT', async () => {
    const service = createService({ id: 'version-1', status: 'DRAFT' });
    const updated = await service.updateClause('version-1', 'clause-1', 'new text');
    expect(updated.text).toBe('new text');
  });
});
