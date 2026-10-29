import { Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CreatePolicyDto, CreateRevisionDto } from './dto.js';
import type { CreatePolicyResponseDto, PolicyDetailDto, PolicySummaryDto, VersionDetailDto } from './dto.js';
import { PoliciesService } from './policies.service.js';
import { PolicyImportService } from './policy-import.service.js';

@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService, private readonly policyImport: PolicyImportService) {}

  @Post('import')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } }))
  importPolicy(@UploadedFile() file: Express.Multer.File | undefined, @Body('title') title: string, @Body('description') description?: string) {
    return this.policyImport.import(file, title, description);
  }

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
