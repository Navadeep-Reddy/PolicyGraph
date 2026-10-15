import { classifyClauseChanges } from './change-classifier.js';

describe('classifyClauseChanges', () => {
  const clause = (stableKey: string, position: number, textHash: string) => ({
    id: `id-${stableKey}`,
    versionId: 'version',
    stableKey,
    title: stableKey,
    text: stableKey,
    category: 'policy',
    position,
    textHash,
  });

  it('classifies added, removed, modified, and unchanged clauses', () => {
    const base = [clause('keep', 0, 'same'), clause('edit', 1, 'old'), clause('remove', 2, 'x')];
    const target = [clause('edit', 0, 'new'), clause('add', 1, 'y'), clause('keep', 2, 'same')];

    expect(classifyClauseChanges(base, target)).toEqual([
      expect.objectContaining({ stableKey: 'edit', changeType: 'MODIFIED', before: base[1], after: target[0] }),
      expect.objectContaining({ stableKey: 'add', changeType: 'ADDED', before: null, after: target[1] }),
      expect.objectContaining({ stableKey: 'keep', changeType: 'UNCHANGED', before: base[0], after: target[2] }),
      expect.objectContaining({ stableKey: 'remove', changeType: 'REMOVED', before: base[2], after: null }),
    ]);
  });

  it('matches reordered clauses by stable key and orders by target position', () => {
    const base = [clause('first', 0, 'a'), clause('second', 1, 'b')];
    const target = [clause('second', 0, 'b'), clause('first', 1, 'a')];
    expect(classifyClauseChanges(base, target).map(({ stableKey }) => stableKey)).toEqual(['second', 'first']);
  });

  it('places removed clauses by base position then stable key deterministically', () => {
    const base = [clause('z', 2, 'x'), clause('b', 1, 'x'), clause('a', 1, 'x')];
    const first = classifyClauseChanges(base, []);
    expect(first.map(({ stableKey }) => stableKey)).toEqual(['a', 'b', 'z']);
    expect(classifyClauseChanges([...base].reverse(), []).map(({ stableKey }) => stableKey)).toEqual(['a', 'b', 'z']);
  });

  it('does not mutate inputs and handles empty collections', () => {
    const base = [clause('old', 0, 'x')];
    const target = [clause('new', 0, 'y')];
    const baseSnapshot = structuredClone(base);
    const targetSnapshot = structuredClone(target);
    expect(classifyClauseChanges([], [])).toEqual([]);
    expect(classifyClauseChanges(base, target)).toHaveLength(2);
    expect(base).toEqual(baseSnapshot);
    expect(target).toEqual(targetSnapshot);
  });
});
