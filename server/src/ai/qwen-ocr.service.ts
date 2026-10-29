import { HttpStatus, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { ContractHttpException } from '../common/contract-http.exception.js';

@Injectable()
export class QwenOcrService {
  async transcribe(png: Uint8Array): Promise<string> {
    try {
      const required = (name: string) => {
        const value = process.env[name]?.trim();
        if (!value) throw new Error(`Missing ${name}`);
        return value;
      };
      const client = new OpenAI({ apiKey: required('QWEN_OCR_API_KEY'), baseURL: required('QWEN_OCR_BASE_URL') });
      const response = await client.chat.completions.create({
        model: required('QWEN_OCR_MODEL'),
        messages: [{ role: 'user', content: [
          { type: 'text', text: 'Transcribe all visible document text exactly. Preserve headings, paragraphs, and list numbering. Do not summarize, interpret, or add text. Return transcription only.' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${Buffer.from(png).toString('base64')}` } },
        ] }],
      });
      const content = response.choices[0]?.message.content;
      const text = typeof content === 'string' ? content.replace(/^```(?:\w+)?\s*|\s*```$/g, '').trim() : '';
      if (!text) throw new Error('Empty transcription');
      return text;
    } catch {
      throw new ContractHttpException('AI_FAILED', 'OCR transcription failed', HttpStatus.BAD_GATEWAY);
    }
  }
}
