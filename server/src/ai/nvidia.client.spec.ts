import { HttpStatus } from '@nestjs/common';
import OpenAI from 'openai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContractHttpException } from '../common/contract-http.exception.js';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function (this: object) {
    return { chat: { completions: { create } } };
  }),
}));

import { NvidiaClient } from './nvidia.client.js';

const envKeys = ['NVIDIA_API_KEY', 'NVIDIA_BASE_URL', 'NVIDIA_MODEL'] as const;
const originalEnvironment = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function configureEnvironment(): void {
  process.env.NVIDIA_API_KEY = ' test-key ';
  process.env.NVIDIA_BASE_URL = ' https://example.invalid/v1 ';
  process.env.NVIDIA_MODEL = ' test-model ';
}

afterEach(() => {
  for (const key of envKeys) {
    const value = originalEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.clearAllMocks();
});

describe('NvidiaClient', () => {
  it.each(envKeys)('requires %s including blank values', (missingKey) => {
    configureEnvironment();
    process.env[missingKey] = '  ';

    expect(() => new NvidiaClient()).toThrow(`Missing required configuration: ${missingKey}`);
  });

  it('uses environment credentials, URL, model, and messages', async () => {
    configureEnvironment();
    create.mockResolvedValue({ id: 'completion' });
    const messages = [{ role: 'user', content: 'hello' }] as const;

    const result = await new NvidiaClient().createChatCompletion([...messages]);

    expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'test-key', baseURL: 'https://example.invalid/v1' });
    expect(create).toHaveBeenCalledWith({ model: 'test-model', messages: [...messages] });
    expect(result).toEqual({ id: 'completion' });
  });

  it('maps provider rejection to AI_FAILED/502 without a fallback call', async () => {
    configureEnvironment();
    create.mockRejectedValue(new Error('sensitive provider details'));

    const client = new NvidiaClient();
    await expect(client.createChatCompletion([{ role: 'user', content: 'hello' }])).rejects.toMatchObject({
      code: 'AI_FAILED',
      message: 'AI request failed',
      status: HttpStatus.BAD_GATEWAY,
    } satisfies Partial<ContractHttpException>);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalledWith(expect.objectContaining({ fallback: expect.anything() }));
  });
});
