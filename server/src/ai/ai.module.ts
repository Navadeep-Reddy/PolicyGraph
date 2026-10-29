import { Module } from '@nestjs/common';
import { NvidiaClient } from './nvidia.client.js';
import { ClauseExtractionService } from './clause-extraction.service.js';
import { DependencySuggestionService } from './dependency-suggestion.service.js';
import { QwenOcrService } from './qwen-ocr.service.js';

@Module({
  providers: [NvidiaClient, ClauseExtractionService, DependencySuggestionService, QwenOcrService],
  exports: [NvidiaClient, ClauseExtractionService, DependencySuggestionService, QwenOcrService],
})
export class AiModule {}
