// Minimal backend-connectivity client for the Phase 1 scaffold.
// This only reads GET /health; real API modules arrive with later phases.

export interface HealthResponse {
  status: string;
  timestamp: string;
}

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

export async function fetchHealth(signal: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${API_URL ?? ""}/health`, { signal });
  if (!response.ok) {
    throw new Error(`Backend responded with ${response.status}`);
  }
  return (await response.json()) as HealthResponse;
}
