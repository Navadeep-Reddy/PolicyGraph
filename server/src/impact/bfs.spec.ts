import { runImpactBfs, type TraversalEdge } from './bfs.js';

const RUN_AT = new Date('2026-09-04T00:00:00Z');

function approvedEdge(id: string, sourceNodeId: string, targetNodeId: string): TraversalEdge {
  return { id, sourceNodeId, targetNodeId, status: 'APPROVED', validFrom: null, validTo: null };
}

describe('runImpactBfs', () => {
  it('finds a direct dependency at distance 1', () => {
    const results = runImpactBfs(
      ['clause-1'],
      [approvedEdge('e1', 'clause-1', 'artifact-form')],
      new Set(['artifact-form']),
      RUN_AT,
    );
    expect(results).toEqual([
      {
        artifactId: 'artifact-form',
        distance: 1,
        pathNodeIds: ['clause-1', 'artifact-form'],
        pathEdgeIds: ['e1'],
      },
    ]);
  });

  it('finds an indirect two-hop dependency with the complete ordered path', () => {
    const results = runImpactBfs(
      ['clause-1'],
      [
        approvedEdge('e1', 'clause-1', 'artifact-form'),
        approvedEdge('e2', 'artifact-form', 'artifact-rule'),
      ],
      new Set(['artifact-form', 'artifact-rule']),
      RUN_AT,
    );
    const rule = results.find((result) => result.artifactId === 'artifact-rule');
    expect(rule).toEqual({
      artifactId: 'artifact-rule',
      distance: 2,
      pathNodeIds: ['clause-1', 'artifact-form', 'artifact-rule'],
      pathEdgeIds: ['e1', 'e2'],
    });
  });

  it('prevents cycles from looping traversal', () => {
    const results = runImpactBfs(
      ['clause-1'],
      [
        approvedEdge('e1', 'clause-1', 'artifact-a'),
        approvedEdge('e2', 'artifact-a', 'artifact-b'),
        approvedEdge('e3', 'artifact-b', 'artifact-a'),
        approvedEdge('e4', 'artifact-b', 'clause-1'),
      ],
      new Set(['artifact-a', 'artifact-b']),
      RUN_AT,
    );
    expect(results).toHaveLength(2);
    expect(results.find((result) => result.artifactId === 'artifact-b')?.distance).toBe(2);
  });

  it('ignores edges that are not APPROVED', () => {
    const results = runImpactBfs(
      ['clause-1'],
      [
        {
          id: 'e1',
          sourceNodeId: 'clause-1',
          targetNodeId: 'artifact-form',
          status: 'PROPOSED',
          validFrom: null,
          validTo: null,
        },
      ],
      new Set(['artifact-form']),
      RUN_AT,
    );
    expect(results).toEqual([]);
  });

  it('ignores edges outside their validity window', () => {
    const results = runImpactBfs(
      ['clause-1'],
      [
        {
          id: 'e1',
          sourceNodeId: 'clause-1',
          targetNodeId: 'artifact-form',
          status: 'APPROVED',
          validFrom: null,
          validTo: new Date('2020-01-01T00:00:00Z'),
        },
      ],
      new Set(['artifact-form']),
      RUN_AT,
    );
    expect(results).toEqual([]);
  });

  it('does not report disconnected artifacts', () => {
    const results = runImpactBfs(
      ['clause-1'],
      [approvedEdge('e1', 'clause-1', 'artifact-form')],
      new Set(['artifact-form', 'artifact-orphan']),
      RUN_AT,
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.artifactId).toBe('artifact-form');
  });

  it('does not duplicate an artifact reachable by multiple paths and keeps the shortest path', () => {
    const results = runImpactBfs(
      ['clause-1'],
      [
        approvedEdge('e-direct', 'clause-1', 'artifact-rule'),
        approvedEdge('e1', 'clause-1', 'artifact-form'),
        approvedEdge('e2', 'artifact-form', 'artifact-rule'),
      ],
      new Set(['artifact-form', 'artifact-rule']),
      RUN_AT,
    );
    const rules = results.filter((result) => result.artifactId === 'artifact-rule');
    expect(rules).toHaveLength(1);
    expect(rules[0]).toEqual({
      artifactId: 'artifact-rule',
      distance: 1,
      pathNodeIds: ['clause-1', 'artifact-rule'],
      pathEdgeIds: ['e-direct'],
    });
  });
});
