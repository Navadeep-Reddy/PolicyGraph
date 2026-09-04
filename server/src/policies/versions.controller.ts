import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { UpdateClauseDto } from './dto.js';
import { PoliciesService } from './policies.service.js';

@Controller('versions')
export class VersionsController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Patch(':versionId/clauses/:clauseId')
  updateClause(
    @Param('versionId') versionId: string,
    @Param('clauseId') clauseId: string,
    @Body() body: UpdateClauseDto,
  ) {
    return this.policiesService.updateClause(versionId, clauseId, body.text);
  }

  @Get(':versionId/changes')
  getChanges(@Param('versionId') versionId: string) {
    return this.policiesService.getChanges(versionId);
  }
}
