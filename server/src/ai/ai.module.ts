import { Module } from '@nestjs/common';
import { NvidiaClient } from './nvidia.client.js';
import { ClauseExtractionService } from './clause-extraction.service.js';
import { DependencySuggestionService } from './dependency-suggestion.service.js';

@Module({
  providers: [NvidiaClient, ClauseExtractionService, DependencySuggestionService],
  exports: [NvidiaClient, ClauseExtractionService, DependencySuggestionService],
})
export class AiModule {}
