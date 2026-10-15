import { HttpStatus } from '@nestjs/common';
import type { ChatCompletion } from 'openai/resources/chat/completions';
import { describe, expect, it, vi } from 'vitest';
import { DependencySuggestionService } from './dependency-suggestion.service.js';
import type { NvidiaClient } from './nvidia.client.js';

const valid = { sourceType: 'CLAUSE', sourceClauseKey: 'STABLE-KEY', sourceArtifactId: null, targetArtifactId: 'item-id', relationshipType: 'GOVERNS', rationale: 'Reason' };
function setup(content: unknown) {
  const createChatCompletion = vi.fn().mockResolvedValue({ choices: [{ message: { content } }] } as unknown as ChatCompletion);
  return { service: new DependencySuggestionService({ createChatCompletion } as unknown as NvidiaClient), createChatCompletion };
}

describe('DependencySuggestionService', () => {
  it('sends the supplied inputs in a strict JSON-only single provider request and parses suggestions', async () => {
    const input = { clauses: [{ stableKey: 'STABLE-KEY', title: 'Title', text: 'Text', category: 'category' }], artifacts: [{ id: 'item-id', name: 'Item', type: 'FORM', department: 'Unit', description: null }], existing: [] };
    const { service, createChatCompletion } = setup(JSON.stringify([valid]));
    await expect(service.suggest(input)).resolves.toEqual([{ ...valid, rationale: 'Reason' }]);
    expect(createChatCompletion).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(createChatCompletion.mock.calls[0])).toContain('STABLE-KEY');
    expect(JSON.stringify(createChatCompletion.mock.calls[0])).toContain('JSON only');
    expect(JSON.stringify(createChatCompletion.mock.calls[0])).not.toContain('row-id');
  });

  it('accepts one JSON fence and drops individually invalid entries', async () => {
    const { service } = setup(`\`\`\`json\n${JSON.stringify([{ ...valid, extra: true }, valid])}\n\`\`\``);
    await expect(service.suggest({ clauses: [], artifacts: [], existing: [] })).resolves.toEqual([{ ...valid, rationale: 'Reason' }]);
  });

  it.each([null, '', '{', '{}', '[]'])('rejects unusable output as AI_FAILED/502', async (content) => {
    const { service } = setup(content);
    await expect(service.suggest({ clauses: [], artifacts: [], existing: [] })).rejects.toMatchObject({ code: 'AI_FAILED', status: HttpStatus.BAD_GATEWAY });
  });
});
