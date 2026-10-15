import { HttpStatus } from '@nestjs/common';
import type { ChatCompletion } from 'openai/resources/chat/completions';
import { describe, expect, it, vi } from 'vitest';
import { ContractHttpException } from '../common/contract-http.exception.js';
import { ClauseExtractionService } from './clause-extraction.service.js';
import type { NvidiaClient } from './nvidia.client.js';

const clause = (stableKey: string, position: number, text = 'Visitors are permitted until 8:00 PM.') => ({
  stableKey, title: 'Visiting hours', text, category: 'visitor_access', position,
});

function setup(content: unknown) {
  const createChatCompletion = vi.fn().mockResolvedValue({
    choices: [{ message: { content } }],
  } as unknown as ChatCompletion);
  const service = new ClauseExtractionService({ createChatCompletion } as unknown as NvidiaClient);
  return { service, createChatCompletion };
}

describe('ClauseExtractionService', () => {
  it('extracts clauses from plain JSON in deterministic position order with one provider call', async () => {
    const { service, createChatCompletion } = setup(JSON.stringify([clause('SECOND', 1), clause('FIRST', 0)]));
    await expect(service.extract('policy text')).resolves.toEqual([clause('FIRST', 0), clause('SECOND', 1)]);
    expect(createChatCompletion).toHaveBeenCalledTimes(1);
  });

  it('includes supplied existing keys and text with an explicit reuse instruction', async () => {
    const existing = [{ stableKey: 'VISITOR-HOURS', text: 'Visitors are permitted until 8:00 PM.' }];
    const { service, createChatCompletion } = setup(JSON.stringify([clause('VISITOR-HOURS', 0)]));
    await service.extract('revised policy', existing);
    const messages = createChatCompletion.mock.calls[0]?.[0];
    const userMessage = messages?.[1];
    expect(typeof userMessage?.content).toBe('string');
    expect(JSON.parse(userMessage?.content as string)).toEqual({ policyText: 'revised policy', existingClauses: existing });
    expect(JSON.stringify(messages)).toContain('reuse a supplied stableKey only when its clause semantically matches');
    expect(JSON.stringify(messages)).toContain('JSON only');
  });

  it('accepts one markdown JSON fence', async () => {
    const { service } = setup(`\`\`\`json\n${JSON.stringify([clause('KEY', 0)])}\n\`\`\``);
    await expect(service.extract('policy')).resolves.toEqual([clause('KEY', 0)]);
  });

  it('discards individually invalid entries when valid clauses remain', async () => {
    const { service } = setup(JSON.stringify([{ ...clause('BAD', -1) }, clause('GOOD', 0)]));
    await expect(service.extract('policy')).resolves.toEqual([clause('GOOD', 0)]);
  });

  it.each([
    ['malformed', '{'],
    ['invalid top-level', JSON.stringify({ clause: clause('KEY', 0) })],
    ['empty', '[]'],
    ['all invalid', JSON.stringify([{ ...clause('KEY', 0), extra: true }])],
    ['duplicate key', JSON.stringify([clause('KEY', 0), clause('KEY', 1)])],
    ['duplicate position', JSON.stringify([clause('ONE', 0), clause('TWO', 0)])],
  ])('rejects %s output as AI_FAILED/502', async (_label, content) => {
    const { service } = setup(content);
    await expect(service.extract('policy')).rejects.toMatchObject({ code: 'AI_FAILED', status: HttpStatus.BAD_GATEWAY });
  });

  it.each([null, '', 4])('rejects absent or non-text content as AI_FAILED/502', async (content) => {
    const { service } = setup(content);
    await expect(service.extract('policy')).rejects.toMatchObject({ code: 'AI_FAILED', status: HttpStatus.BAD_GATEWAY });
  });

  it('passes through transport AI_FAILED without retry or fallback', async () => {
    const failure = new ContractHttpException('AI_FAILED', 'AI request failed', HttpStatus.BAD_GATEWAY);
    const createChatCompletion = vi.fn().mockRejectedValue(failure);
    const service = new ClauseExtractionService({ createChatCompletion } as unknown as NvidiaClient);
    await expect(service.extract('policy')).rejects.toBe(failure);
    expect(createChatCompletion).toHaveBeenCalledTimes(1);
  });
});
