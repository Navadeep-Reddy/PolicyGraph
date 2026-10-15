import { HttpStatus, Injectable } from '@nestjs/common';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { ContractHttpException } from '../common/contract-http.exception.js';
import { NvidiaClient } from './nvidia.client.js';

export interface ExtractedClause {
  stableKey: string;
  title: string;
  text: string;
  category: string;
  position: number;
}

export interface ExistingClause {
  stableKey: string;
  text: string;
}

const unusableOutput = (): ContractHttpException =>
  new ContractHttpException('AI_FAILED', 'AI returned unusable clause data', HttpStatus.BAD_GATEWAY);

@Injectable()
export class ClauseExtractionService {
  constructor(private readonly nvidiaClient: NvidiaClient) {}

  async extract(policyText: string, existingClauses: ExistingClause[] = []): Promise<ExtractedClause[]> {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: 'Extract hospital policy clauses from the supplied source text. Return JSON only: an array of objects with exactly these fields: stableKey, title, text, category, position. Preserve clause wording from the source; do not invent or paraphrase source text. Assign each genuinely new clause a unique stableKey. When existing clauses are supplied, reuse a supplied stableKey only when its clause semantically matches; otherwise assign a unique key to the genuinely new clause. Positions are unique non-negative integers.',
      },
      {
        role: 'user',
        content: JSON.stringify({ policyText, existingClauses }),
      },
    ];
    const completion = await this.nvidiaClient.createChatCompletion(messages);
    const content: unknown = completion.choices[0]?.message.content;
    if (typeof content !== 'string' || !content.trim()) throw unusableOutput();

    const parsed = parseJsonContent(content);
    if (!Array.isArray(parsed)) throw unusableOutput();

    const clauses: ExtractedClause[] = [];
    const keys = new Set<string>();
    const positions = new Set<number>();
    let hasDuplicate = false;

    for (const entry of parsed) {
      const clause = validateClause(entry);
      if (!clause) continue;
      if (keys.has(clause.stableKey) || positions.has(clause.position)) {
        hasDuplicate = true;
        continue;
      }
      keys.add(clause.stableKey);
      positions.add(clause.position);
      clauses.push(clause);
    }

    if (hasDuplicate || clauses.length === 0) throw unusableOutput();
    return clauses.sort((left, right) => left.position - right.position);
  }
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  try {
    return JSON.parse(fenced?.[1] ?? trimmed) as unknown;
  } catch {
    throw unusableOutput();
  }
}

function validateClause(value: unknown): ExtractedClause | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const required = ['stableKey', 'title', 'text', 'category', 'position'];
  if (Object.keys(record).length !== required.length || required.some((key) => !(key in record))) return null;
  if (!required.slice(0, 4).every((key) => typeof record[key] === 'string' && record[key].trim().length > 0)) return null;
  if (typeof record.position !== 'number' || !Number.isInteger(record.position) || record.position < 0) return null;
  return {
    stableKey: record.stableKey as string,
    title: record.title as string,
    text: record.text as string,
    category: record.category as string,
    position: record.position,
  };
}
