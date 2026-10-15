import { runImpactBfs, type TraversalChange, type TraversalEdge } from './bfs.js';

const changed: TraversalChange[] = [{ stableKey: 'K', changeType: 'MODIFIED' }];
const edge = (id: string, sourceNodeId: string, targetNodeId: string, status = 'APPROVED'): TraversalEdge => ({ id, sourceNodeId, targetNodeId, status });
const artifacts = (...ids: string[]) => new Set(ids.map((id) => `artifact:${id}`));

describe('runImpactBfs', () => {
  it('finds direct and indirect dependencies with complete ordered paths and edge-count distances', () => {
    expect(runImpactBfs(changed, [edge('e1', 'clause:K', 'artifact:a'), edge('e2', 'artifact:a', 'artifact:b')], artifacts('a', 'b'))).toEqual([
      { changedClauseKey: 'K', artifactId: 'a', distance: 1, pathNodeIds: ['clause:K', 'artifact:a'], pathEdgeIds: ['e1'] },
      { changedClauseKey: 'K', artifactId: 'b', distance: 2, pathNodeIds: ['clause:K', 'artifact:a', 'artifact:b'], pathEdgeIds: ['e1', 'e2'] },
    ]);
  });

  it('is cycle-safe and ignores PROPOSED and REJECTED edges', () => {
    const results = runImpactBfs(changed, [edge('a', 'clause:K', 'artifact:a'), edge('b', 'artifact:a', 'artifact:b'), edge('cycle', 'artifact:b', 'artifact:a'), edge('back', 'artifact:b', 'clause:K'), edge('p', 'clause:K', 'artifact:p', 'PROPOSED'), edge('r', 'clause:K', 'artifact:r', 'REJECTED')], artifacts('a', 'b', 'p', 'r'));
    expect(results.map(({ artifactId }) => artifactId)).toEqual(['a', 'b']);
  });

  it('omits disconnected artifacts and traverses outgoing edges only', () => {
    expect(runImpactBfs(changed, [edge('incoming', 'artifact:a', 'clause:K')], artifacts('a'))).toEqual([]);
  });

  it('deduplicates duplicate/alternative paths and deterministically selects the lexicographically first shortest path', () => {
    const input = [edge('z', 'clause:K', 'artifact:a'), edge('b-to-target', 'artifact:b', 'artifact:t'), edge('a-to-target', 'artifact:a', 'artifact:t'), edge('a-to-target', 'artifact:a', 'artifact:t'), edge('a-start', 'clause:K', 'artifact:b')];
    const forward = runImpactBfs(changed, input, artifacts('a', 'b', 't'));
    const reverse = runImpactBfs(changed, [...input].reverse(), artifacts('a', 'b', 't'));
    expect(forward).toEqual(reverse);
    expect(forward.filter(({ artifactId }) => artifactId === 't')).toEqual([
      { changedClauseKey: 'K', artifactId: 't', distance: 2, pathNodeIds: ['clause:K', 'artifact:a', 'artifact:t'], pathEdgeIds: ['z', 'a-to-target'] },
    ]);
  });

  it('emits an artifact once for each eligible changed clause and excludes ADDED/UNCHANGED starts', () => {
    const changes: TraversalChange[] = [
      { stableKey: 'Z', changeType: 'MODIFIED' }, { stableKey: 'A', changeType: 'REMOVED' },
      { stableKey: 'N', changeType: 'ADDED' }, { stableKey: 'U', changeType: 'UNCHANGED' },
    ];
    const results = runImpactBfs(changes, [edge('a', 'clause:A', 'artifact:x'), edge('z', 'clause:Z', 'artifact:x'), edge('n', 'clause:N', 'artifact:x'), edge('u', 'clause:U', 'artifact:x')], artifacts('x'));
    expect(results.map(({ changedClauseKey, artifactId }) => [changedClauseKey, artifactId])).toEqual([['A', 'x'], ['Z', 'x']]);
  });

  it('does not mutate inputs', () => {
    const inputChanges = [...changed];
    const inputEdges = [edge('e', 'clause:K', 'artifact:a')];
    const inputArtifacts = artifacts('a');
    const before = [structuredClone(inputChanges), structuredClone(inputEdges), structuredClone([...inputArtifacts])];
    runImpactBfs(inputChanges, inputEdges, inputArtifacts);
    expect([inputChanges, inputEdges, [...inputArtifacts]]).toEqual(before);
  });
});
