import { createHash } from 'node:crypto';

export type ClauseChangeType = 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';

export interface ClassifiableClause {
  stableKey: string;
  textHash: string;
  position: number;
}

export interface ClauseChange<BaseClause, TargetClause> {
  stableKey: string;
  changeType: ClauseChangeType;
  before: BaseClause | null;
  after: TargetClause | null;
  predecessorClause: BaseClause | null;
  draftClause: TargetClause | null;
}

export function hashClauseText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function classifyClauseChanges<BaseClause extends ClassifiableClause, TargetClause extends ClassifiableClause>(
  baseClauses: readonly BaseClause[],
  targetClauses: readonly TargetClause[],
): ClauseChange<BaseClause, TargetClause>[] {
  const baseByKey = new Map(baseClauses.map((clause) => [clause.stableKey, clause]));
  const targetByKey = new Map(targetClauses.map((clause) => [clause.stableKey, clause]));
  const targetOrdered = [...targetClauses].sort((left, right) => left.position - right.position || left.stableKey.localeCompare(right.stableKey));
  const removed = baseClauses
    .filter((clause) => !targetByKey.has(clause.stableKey))
    .sort((left, right) => left.position - right.position || left.stableKey.localeCompare(right.stableKey));
  const orderedKeys = [...targetOrdered.map((clause) => clause.stableKey), ...removed.map((clause) => clause.stableKey)];
  return orderedKeys.map((stableKey) => {
    const before = baseByKey.get(stableKey) ?? null;
    const after = targetByKey.get(stableKey) ?? null;
    let changeType: ClauseChangeType;
    if (before === null) {
      changeType = 'ADDED';
    } else if (after === null) {
      changeType = 'REMOVED';
    } else if (before.textHash !== after.textHash) {
      changeType = 'MODIFIED';
    } else {
      changeType = 'UNCHANGED';
    }
    return { stableKey, changeType, before, after, predecessorClause: before, draftClause: after };
  });
}
