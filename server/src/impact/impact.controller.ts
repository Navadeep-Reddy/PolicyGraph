import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UpdateReviewDto } from './dto.js';
import { ImpactService } from './impact.service.js';

@Controller()
export class ImpactController {
  constructor(private readonly impactService: ImpactService) {}

  @Post('versions/:versionId/impact-runs')
  createImpactRun(@Param('versionId') versionId: string) {
    return this.impactService.createImpactRun(versionId);
  }

  @Get('impact-runs/:impactRunId')
  getImpactRun(@Param('impactRunId') impactRunId: string) {
    return this.impactService.getImpactRun(impactRunId);
  }

  @Patch('impact-results/:impactResultId')
  updateImpactResult(
    @Param('impactResultId') impactResultId: string,
    @Body() body: UpdateReviewDto,
  ) {
    return this.impactService.updateImpactResult(
      impactResultId,
      body.reviewStatus,
      body.reviewComment,
    );
  }
}
