import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreatePolicyDto, CreateRevisionDto } from './dto.js';
import type { CreatePolicyResponseDto, PolicyDetailDto, PolicySummaryDto, VersionDetailDto } from './dto.js';
import { PoliciesService } from './policies.service.js';

@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Post()
  createPolicy(@Body() body: CreatePolicyDto): Promise<CreatePolicyResponseDto> {
    return this.policiesService.createPolicy(body);
  }

  @Post(':id/revisions')
  createRevision(@Param('id') policyId: string, @Body() body: CreateRevisionDto): Promise<VersionDetailDto> {
    return this.policiesService.createRevision(policyId, body);
  }

  @Get()
  listPolicies(): Promise<PolicySummaryDto[]> {
    return this.policiesService.listPolicies();
  }

  @Get(':id')
  getPolicy(@Param('id') policyId: string): Promise<PolicyDetailDto> {
    return this.policiesService.getPolicy(policyId);
  }

}
