import { buildImpactReason, InvalidImpactPathError, type ResolvedImpactPath } from './reason-builder.js';

const node = (id: string, nodeType: 'CLAUSE' | 'ARTIFACT', name: string) => ({ id, nodeType, name });
const path: ResolvedImpactPath = {
  nodes: [node('clause:VISITOR-HOURS', 'CLAUSE', 'VISITOR-HOURS'), node('artifact:procedure', 'ARTIFACT', 'Security desk procedure'), node('artifact:training', 'ARTIFACT', 'Staff training')],
  edges: [
    { id: 'e1', sourceNodeId: 'clause:VISITOR-HOURS', targetNodeId: 'artifact:procedure', relationshipType: 'GOVERNS', relationshipLabel: 'governs', status: 'APPROVED' },
    { id: 'e2', sourceNodeId: 'artifact:procedure', targetNodeId: 'artifact:training', relationshipType: 'UPDATES', relationshipLabel: 'updates', status: 'APPROVED' },
  ],
};

describe('buildImpactReason', () => {
  it('builds the exact direct-path reason', () => {
    const direct = { nodes: path.nodes.slice(0, 2), edges: path.edges.slice(0, 1) };
    expect(buildImpactReason('MODIFIED', 'VISITOR-HOURS', 'Security desk procedure', direct)).toBe('MODIFIED clause "VISITOR-HOURS" affects operational item "Security desk procedure" via "VISITOR-HOURS" --GOVERNS--> "Security desk procedure".');
  });

  it('explains indirect hops in order', () => {
    expect(buildImpactReason('MODIFIED', 'VISITOR-HOURS', 'Staff training', path)).toBe('MODIFIED clause "VISITOR-HOURS" affects operational item "Staff training" via "VISITOR-HOURS" --GOVERNS--> "Security desk procedure"; then "Security desk procedure" --UPDATES--> "Staff training".');
  });

  it.each(['GOVERNS', 'UPDATES', 'APPEARS_IN'] as const)('includes relationship %s', (relationship) => {
    const direct = { nodes: path.nodes.slice(0, 2), edges: [{ ...path.edges[0]!, relationshipType: relationship }] };
    expect(buildImpactReason('REMOVED', 'VISITOR-HOURS', 'Security desk procedure', direct)).toContain(`--${relationship}-->`);
  });

  it('rejects empty, discontinuous, and endpoint-mismatched paths', () => {
    expect(() => buildImpactReason('MODIFIED', 'K', 'item', { nodes: [], edges: [] })).toThrow(InvalidImpactPathError);
    expect(() => buildImpactReason('MODIFIED', 'VISITOR-HOURS', 'Staff training', { ...path, edges: [{ ...path.edges[0]!, targetNodeId: 'artifact:wrong' }, path.edges[1]!] })).toThrow(InvalidImpactPathError);
    expect(() => buildImpactReason('MODIFIED', 'OTHER', 'Staff training', path)).toThrow(InvalidImpactPathError);
  });

  it('is deterministic and does not mutate its input', () => {
    const before = structuredClone(path);
    const first = buildImpactReason('MODIFIED', 'VISITOR-HOURS', 'Staff training', path);
    expect(buildImpactReason('MODIFIED', 'VISITOR-HOURS', 'Staff training', path)).toBe(first);
    expect(path).toEqual(before);
  });

  it('has no AI/provider dependency', () => {
    expect(() => buildImpactReason('MODIFIED', 'VISITOR-HOURS', 'Staff training', path)).not.toThrow();
  });
});
