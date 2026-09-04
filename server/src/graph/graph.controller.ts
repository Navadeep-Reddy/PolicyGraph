import { Controller, Get, Param } from '@nestjs/common';
import { GraphService } from './graph.service.js';

@Controller('policies')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get(':id/graph')
  getPolicyGraph(@Param('id') policyId: string) {
    return this.graphService.getPolicyGraph(policyId);
  }
}
