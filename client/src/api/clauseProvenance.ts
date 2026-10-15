const storageKey = (policyId: string) => `caresync:ai-proposed-clauses:${policyId}`;

export function rememberAiProposedClauses(policyId: string, clauseIds: string[]) {
  try {
    localStorage.setItem(storageKey(policyId), JSON.stringify(clauseIds));
  } catch {
    // Provenance is a UI hint; unavailable browser storage must not block policy work.
  }
}

export function getAiProposedClauseIds(policyId: string): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey(policyId)) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function clearAiProposedClauses(policyId: string) {
  try {
    localStorage.removeItem(storageKey(policyId));
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}
