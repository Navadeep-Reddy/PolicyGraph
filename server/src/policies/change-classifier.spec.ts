import { classifyClauseChanges, hashClauseText } from './change-classifier.js';

describe('classifyClauseChanges', () => {
  it('marks same key with different text hash as MODIFIED', () => {
    const changes = classifyClauseChanges(
      [{ stableKey: 'TRAVEL-CLAIM-DEADLINE', textHash: hashClauseText('within 30 days') }],
      [{ stableKey: 'TRAVEL-CLAIM-DEADLINE', textHash: hashClauseText('within 15 days') }],
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]?.changeType).toBe('MODIFIED');
  });

  it('marks same key with same text hash as UNCHANGED', () => {
    const hash = hashClauseText('same text');
    const changes = classifyClauseChanges(
      [{ stableKey: 'K', textHash: hash }],
      [{ stableKey: 'K', textHash: hash }],
    );
    expect(changes[0]?.changeType).toBe('UNCHANGED');
  });

  it('marks draft-only keys as ADDED and predecessor-only keys as REMOVED', () => {
    const changes = classifyClauseChanges(
      [{ stableKey: 'OLD', textHash: 'a' }],
      [{ stableKey: 'NEW', textHash: 'b' }],
    );
    expect(changes).toEqual([
      { stableKey: 'NEW', changeType: 'ADDED', predecessorClause: null, draftClause: { stableKey: 'NEW', textHash: 'b' } },
      { stableKey: 'OLD', changeType: 'REMOVED', predecessorClause: { stableKey: 'OLD', textHash: 'a' }, draftClause: null },
    ]);
  });

  it('classifies the canonical 30-day to 15-day draft as MODIFIED', () => {
    const changes = classifyClauseChanges(
      [
        {
          stableKey: 'TRAVEL-CLAIM-DEADLINE',
          textHash: hashClauseText(
            'Employees must submit travel reimbursement claims within 30 days of travel completion.',
          ),
        },
      ],
      [
        {
          stableKey: 'TRAVEL-CLAIM-DEADLINE',
          textHash: hashClauseText(
            'Employees must submit travel reimbursement claims within 15 days of travel completion.',
          ),
        },
      ],
    );
    expect(changes).toEqual([
      expect.objectContaining({ stableKey: 'TRAVEL-CLAIM-DEADLINE', changeType: 'MODIFIED' }),
    ]);
  });
});
