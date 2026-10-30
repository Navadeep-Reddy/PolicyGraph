const listeners = new Set<() => void>();
const pending = new Map<symbol, string>();

export const subscribeToActivity = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const getActivity = (): string | null => pending.values().next().value ?? null;

export async function trackRequest<T>(message: string, operation: () => Promise<T>): Promise<T> {
  const token = Symbol();
  pending.set(token, message);
  listeners.forEach(listener => listener());
  try {
    return await operation();
  } finally {
    pending.delete(token);
    listeners.forEach(listener => listener());
  }
}

export function requestMessage(path: string, method = "GET"): string {
  if (method === "GET") return path === "/policies" ? "Loading policies…" : "Loading data…";
  if (path.endsWith("dependency-suggestions")) return "Generating dependency suggestions…";
  if (path.endsWith("impact-runs")) return "Analyzing policy impact…";
  if (path === "/policies" || path === "/policies/import") return "Extracting policy clauses…";
  if (method === "DELETE") return "Removing record…";
  return "Saving changes…";
}
