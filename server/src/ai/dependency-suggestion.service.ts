import { HttpStatus, Injectable } from '@nestjs/common';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { EdgeRelationship } from '../generated/prisma/enums.js';
import type { EdgeRelationship as RelationshipType, DependencyNodeType } from '../generated/prisma/enums.js';
import { ContractHttpException } from '../common/contract-http.exception.js';
import { NvidiaClient } from './nvidia.client.js';

export interface DependencySuggestion {
  sourceType: DependencyNodeType;
  sourceClauseKey: string | null;
  sourceArtifactId: string | null;
  targetArtifactId: string;
  relationshipType: RelationshipType;
  rationale: string | null;
}

const unusable = (): ContractHttpException => new ContractHttpException('AI_FAILED', 'AI returned unusable dependency data', HttpStatus.BAD_GATEWAY);

@Injectable()
export class DependencySuggestionService {
  constructor(private readonly nvidiaClient: NvidiaClient) {}

  async suggest(input: { clauses: { stableKey: string; title: string; text: string; category: string }[]; artifacts: { id: string; name: string; type: string; department: string; description: string | null }[]; existing: { sourceType: string; sourceClauseKey: string | null; sourceArtifactId: string | null; targetArtifactId: string; relationshipType: string }[] }): Promise<DependencySuggestion[]> {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: 'Suggest hospital operational dependencies only from the supplied data. Return JSON only: an array of objects with exactly sourceType, sourceClauseKey, sourceArtifactId, targetArtifactId, relationshipType, and optional rationale. sourceType is CLAUSE or ARTIFACT; for CLAUSE provide sourceClauseKey and null sourceArtifactId, for ARTIFACT provide sourceArtifactId and null sourceClauseKey. relationshipType must be GOVERNS, UPDATES, or APPEARS_IN. Do not suggest self-links or any identity already listed in existingDependencies. Do not add fields.' },
      { role: 'user', content: JSON.stringify(input) },
    ];
    const completion = await this.nvidiaClient.createChatCompletion(messages);
    const content: unknown = completion.choices[0]?.message.content;
    if (typeof content !== 'string' || !content.trim()) throw unusable();
    let parsed: unknown;
    const trimmed = content.trim();
    const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
    try { parsed = JSON.parse(fence?.[1] ?? trimmed) as unknown; } catch { throw unusable(); }
    if (!Array.isArray(parsed) || parsed.length === 0) throw unusable();
    return parsed.map(validate).filter((item): item is DependencySuggestion => item !== null);
  }
}

function validate(value: unknown): DependencySuggestion | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.some((key) => !['sourceType', 'sourceClauseKey', 'sourceArtifactId', 'targetArtifactId', 'relationshipType', 'rationale'].includes(key)) ||
    !['sourceType', 'sourceClauseKey', 'sourceArtifactId', 'targetArtifactId', 'relationshipType'].every((key) => key in record)) return null;
  if (record.sourceType !== 'CLAUSE' && record.sourceType !== 'ARTIFACT') return null;
  if (typeof record.targetArtifactId !== 'string' || !record.targetArtifactId.trim() || !Object.values(EdgeRelationship).includes(record.relationshipType as RelationshipType)) return null;
  if (record.rationale !== undefined && record.rationale !== null && typeof record.rationale !== 'string') return null;
  if (record.sourceType === 'CLAUSE') {
    if (typeof record.sourceClauseKey !== 'string' || !record.sourceClauseKey.trim() || record.sourceArtifactId !== null) return null;
  } else if (typeof record.sourceArtifactId !== 'string' || !record.sourceArtifactId.trim() || record.sourceClauseKey !== null) return null;
  return { sourceType: record.sourceType, sourceClauseKey: record.sourceClauseKey as string | null, sourceArtifactId: record.sourceArtifactId as string | null,
    targetArtifactId: record.targetArtifactId, relationshipType: record.relationshipType as RelationshipType, rationale: (record.rationale as string | null | undefined) ?? null };
}
