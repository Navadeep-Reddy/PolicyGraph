import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { CreateClauseDto, UpdateClauseDto } from './dto.js';
import type { VersionDetailDto } from './dto.js';
import { PoliciesService } from './policies.service.js';

@Controller('versions')
export class VersionsController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Post(':versionId/clauses')
  createClause(@Param('versionId') versionId: string, @Body() body: CreateClauseDto) {
    return this.policiesService.createClause(versionId, body);
  }

  @Get(':versionId')
  getVersion(@Param('versionId') versionId: string): Promise<VersionDetailDto> {
    return this.policiesService.getVersion(versionId);
  }

  @Post(':versionId/publish')
  @HttpCode(HttpStatus.OK)
  publishVersion(@Param('versionId') versionId: string): Promise<VersionDetailDto> {
    return this.policiesService.publishVersion(versionId);
  }

  @Patch(':versionId/clauses/:clauseId')
  updateClause(
    @Param('versionId') versionId: string,
    @Param('clauseId') clauseId: string,
    @Body() body: UpdateClauseDto,
  ) {
    return this.policiesService.updateClause(versionId, clauseId, body);
  }

  @Delete(':versionId/clauses/:clauseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteClause(@Param('versionId') versionId: string, @Param('clauseId') clauseId: string): Promise<void> {
    return this.policiesService.deleteClause(versionId, clauseId);
  }

  @Get(':versionId/changes')
  getChanges(@Param('versionId') versionId: string) {
    return this.policiesService.getChanges(versionId);
  }
}
