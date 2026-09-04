import { Module } from '@nestjs/common';
import { PoliciesController } from './policies.controller.js';
import { VersionsController } from './versions.controller.js';
import { PoliciesService } from './policies.service.js';

@Module({
  controllers: [PoliciesController, VersionsController],
  providers: [PoliciesService],
})
export class PoliciesModule {}
