import { Module } from '@nestjs/common';
import { NvidiaClient } from './nvidia.client.js';
import { ClauseExtractionService } from './clause-extraction.service.js';

@Module({
  providers: [NvidiaClient, ClauseExtractionService],
  exports: [NvidiaClient, ClauseExtractionService],
})
export class AiModule {}
