import { afterEach, describe, expect, it, vi } from 'vitest';
import { QwenOcrService } from './qwen-ocr.service.js';

const create = vi.fn();
vi.mock('openai', () => ({ default: class { chat = { completions: { create } }; } }));

describe('QwenOcrService', () => {
  afterEach(() => { vi.clearAllMocks(); delete process.env.QWEN_OCR_API_KEY; delete process.env.QWEN_OCR_BASE_URL; delete process.env.QWEN_OCR_MODEL; });
  it('sends PNG bytes as a base64 image URL', async () => {
    process.env.QWEN_OCR_API_KEY = 'local'; process.env.QWEN_OCR_BASE_URL = 'http://localhost:11434/v1'; process.env.QWEN_OCR_MODEL = 'qwen3-vl:8b';
    create.mockResolvedValue({ choices: [{ message: { content: 'Text here' } }] });
    await expect(new QwenOcrService().transcribe(Buffer.from('png'))).resolves.toBe('Text here');
    expect(create.mock.calls[0]?.[0].model).toBe('qwen3-vl:8b');
    expect(create.mock.calls[0]?.[0].messages[0].content[1].image_url.url).toBe(`data:image/png;base64,${Buffer.from('png').toString('base64')}`);
  });
  it('maps missing configuration and provider failures to AI_FAILED', async () => {
    await expect(new QwenOcrService().transcribe(Buffer.from('png'))).rejects.toMatchObject({ code: 'AI_FAILED', status: 502 });
    process.env.QWEN_OCR_API_KEY = 'local'; process.env.QWEN_OCR_BASE_URL = 'http://localhost:11434/v1'; process.env.QWEN_OCR_MODEL = 'qwen3-vl:8b';
    create.mockRejectedValue(new Error('provider failure'));
    await expect(new QwenOcrService().transcribe(Buffer.from('png'))).rejects.toMatchObject({ code: 'AI_FAILED', status: 502 });
  });
  it('maps empty provider output to AI_FAILED', async () => {
    process.env.QWEN_OCR_API_KEY = 'local'; process.env.QWEN_OCR_BASE_URL = 'http://localhost:11434/v1'; process.env.QWEN_OCR_MODEL = 'qwen3-vl:8b';
    create.mockResolvedValue({ choices: [{ message: { content: '' } }] });
    await expect(new QwenOcrService().transcribe(Buffer.from('png'))).rejects.toMatchObject({ code: 'AI_FAILED', status: 502 });
  });
});
