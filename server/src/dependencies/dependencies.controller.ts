import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateDependencyDto, DependencyQueryDto, DependencySuggestionRequestDto, UpdateDependencyDto } from './dto.js';
import type { DependencyDto, DependencySuggestionsDto } from './dto.js';
import { DependenciesService } from './dependencies.service.js';

@Controller()
export class DependenciesController {
  constructor(private readonly dependencies: DependenciesService) {}

  @Get('policies/:id/dependencies')
  list(@Param('id') policyId: string, @Query() query: DependencyQueryDto): Promise<DependencyDto[]> {
    return this.dependencies.list(policyId, query.status);
  }

  @Post('policies/:id/dependencies')
  create(@Param('id') policyId: string, @Body() body: CreateDependencyDto): Promise<DependencyDto> {
    return this.dependencies.create(policyId, body);
  }

  @Post('policies/:id/dependency-suggestions')
  suggest(@Param('id') policyId: string, @Body() body: DependencySuggestionRequestDto): Promise<DependencySuggestionsDto> {
    return this.dependencies.suggest(policyId, body.versionId);
  }

  @Patch('dependencies/:id')
  update(@Param('id') id: string, @Body() body: UpdateDependencyDto): Promise<DependencyDto> {
    return this.dependencies.update(id, body);
  }

  @Delete('dependencies/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string): Promise<void> { return this.dependencies.delete(id); }
}
