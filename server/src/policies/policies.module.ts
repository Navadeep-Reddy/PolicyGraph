import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { PoliciesController } from './policies.controller.js';
import { VersionsController } from './versions.controller.js';
import { PoliciesService } from './policies.service.js';

@Module({
  imports: [AiModule],
  controllers: [PoliciesController, VersionsController],
  providers: [PoliciesService],
})
export class PoliciesModule {}
