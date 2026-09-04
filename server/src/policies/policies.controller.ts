import { Controller, Get, Param } from '@nestjs/common';
import { PoliciesService } from './policies.service.js';

@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get()
  listPolicies() {
    return this.policiesService.listPolicies();
  }

  @Get(':id')
  getPolicy(@Param('id') policyId: string) {
    return this.policiesService.getPolicy(policyId);
  }

  @Get(':id/versions')
  listVersions(@Param('id') policyId: string) {
    return this.policiesService.listVersions(policyId);
  }
}
