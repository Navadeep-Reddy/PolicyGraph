import { Injectable, HttpStatus } from '@nestjs/common';
import OpenAI from 'openai';
import type { ChatCompletion, ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { ContractHttpException } from '../common/contract-http.exception.js';

@Injectable()
export class NvidiaClient {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    const apiKey = this.requiredEnvironmentValue('NVIDIA_API_KEY');
    const baseURL = this.requiredEnvironmentValue('NVIDIA_BASE_URL');
    this.model = this.requiredEnvironmentValue('NVIDIA_MODEL');
    this.client = new OpenAI({ apiKey, baseURL });
  }

  async createChatCompletion(messages: ChatCompletionMessageParam[]): Promise<ChatCompletion> {
    try {
      return await this.client.chat.completions.create({ model: this.model, messages });
    } catch {
      throw new ContractHttpException('AI_FAILED', 'AI request failed', HttpStatus.BAD_GATEWAY);
    }
  }

  private requiredEnvironmentValue(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
      throw new Error(`Missing required configuration: ${name}`);
    }
    return value;
  }
}
