import { Module } from '@nestjs/common';
import { GraphModule } from '../graph/graph.module.js';
import { ImpactController } from './impact.controller.js';
import { ImpactService } from './impact.service.js';

@Module({
  imports: [GraphModule],
  controllers: [ImpactController],
  providers: [ImpactService],
})
export class ImpactModule {}
