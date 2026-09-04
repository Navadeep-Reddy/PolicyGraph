// Pure clause change classification for the PolicyGraph one-day MVP.
//
// Implements MVP_SPEC.md section 6: predecessor and draft clauses are matched
// by stableKey only (no embeddings or semantic matching). This module is
// intentionally free of NestJS/Prisma imports so it can be unit-tested in
// isolation and reused by any service.

import { createHash } from 'node:crypto';

export type ClauseChangeType = 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';

export interface ClassifiableClause {
  stableKey: string;
  textHash: string;
}

export interface ClauseChange<Predecessor, Draft> {
  stableKey: string;
  changeType: ClauseChangeType;
  predecessorClause: Predecessor | null;
  draftClause: Draft | null;
}

// Stable SHA-256 hash of clause text. Stored as Clause.textHash and compared
// to detect MODIFIED clauses.
export function hashClauseText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

// Compares predecessor (ACTIVE) clauses against draft clauses by stableKey:
// key only in draft -> ADDED, key only in predecessor -> REMOVED,
// same key + different text hash -> MODIFIED, same key + same hash -> UNCHANGED.
// Results are sorted by stableKey so API responses are deterministic.
export function classifyClauseChanges<Predecessor extends ClassifiableClause, Draft extends ClassifiableClause>(
  predecessorClauses: readonly Predecessor[],
  draftClauses: readonly Draft[],
): ClauseChange<Predecessor, Draft>[] {
  const predecessorByKey = new Map(predecessorClauses.map((clause) => [clause.stableKey, clause]));
  const draftByKey = new Map(draftClauses.map((clause) => [clause.stableKey, clause]));
  const stableKeys = [...new Set([...predecessorByKey.keys(), ...draftByKey.keys()])].sort();
  return stableKeys.map((stableKey) => {
    const predecessorClause = predecessorByKey.get(stableKey) ?? null;
    const draftClause = draftByKey.get(stableKey) ?? null;
    let changeType: ClauseChangeType;
    if (predecessorClause === null) {
      changeType = 'ADDED';
    } else if (draftClause === null) {
      changeType = 'REMOVED';
    } else if (predecessorClause.textHash !== draftClause.textHash) {
      changeType = 'MODIFIED';
    } else {
      changeType = 'UNCHANGED';
    }
    return { stableKey, changeType, predecessorClause, draftClause };
  });
}
