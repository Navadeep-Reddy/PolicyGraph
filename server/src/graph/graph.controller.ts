import { Controller, Get, Param, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { GraphService } from './graph.service.js';
import { GraphQueryDto } from './dto.js';

@Controller('policies')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get(':id/graph')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  getPolicyGraph(@Param('id') policyId: string, @Query() query: GraphQueryDto) {
    return this.graphService.getPolicyGraph(policyId, query.versionId);
  }
}
