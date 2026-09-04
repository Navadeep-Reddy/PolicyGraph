import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { PolicyGraphDto, GraphEdgeDto, GraphNodeDto } from '../graph/dto.js';
import type { ClauseChangeDto } from '../policies/dto.js';

export const REVIEW_STATUSES = ['PROPOSED', 'CONFIRMED', 'DISMISSED', 'RESOLVED'] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

// PATCH /impact-results/:impactResultId request body.
export class UpdateReviewDto {
  @IsIn([...REVIEW_STATUSES])
  reviewStatus!: ReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewComment?: string;
}

export interface ImpactResultArtifactDto {
  id: string;
  name: string;
  type: 'FORM' | 'PROCEDURE' | 'SOFTWARE_RULE';
  description: string | null;
  criticality: number;
}

export interface ImpactResultDto {
  id: string;
  artifact: ImpactResultArtifactDto;
  distance: number;
  reason: string;
  reviewStatus: ReviewStatus;
  reviewComment: string | null;
  path: {
    nodes: GraphNodeDto[];
    edges: GraphEdgeDto[];
  };
}

export interface ImpactReportDto {
  id: string;
  policyVersionId: string;
  policyId: string;
  createdAt: string;
  changeSummary: ClauseChangeDto[];
  graph: PolicyGraphDto;
  results: ImpactResultDto[];
}
