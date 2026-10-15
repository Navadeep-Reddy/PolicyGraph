import { IsIn, IsString, MaxLength, ValidateIf } from 'class-validator';

export const REVIEW_STATUSES = ['PROPOSED', 'CONFIRMED', 'DISMISSED', 'RESOLVED'] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

// PATCH /impact-results/:impactResultId request body.
export class UpdateReviewDto {
  @IsIn([...REVIEW_STATUSES])
  reviewStatus!: ReviewStatus;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(2000)
  reviewComment?: string;
}

export interface ImpactResultArtifactDto {
  id: string;
  name: string;
  type: 'FORM' | 'PROCEDURE' | 'CHECKLIST' | 'TRAINING_MATERIAL' | 'DEPARTMENT_INSTRUCTION' | 'INFORMATION_SHEET';
  department: string;
}

export interface ImpactResultDto {
  id: string;
  changedClauseKey: string;
  artifact: ImpactResultArtifactDto;
  distance: number;
  reason: string;
  reviewStatus: ReviewStatus;
  reviewComment: string | null;
  path: {
    nodes: { id: string; type: 'CLAUSE' | 'ARTIFACT'; label: string }[];
    edges: { id: string; relationshipType: string }[];
  };
}

export interface ImpactReportDto {
  id: string;
  policyId: string;
  policyTitle: string;
  versionId: string;
  baseVersionId: string;
  createdAt: string;
  changedClauses: { stableKey: string; changeType: string; oldText: string | null; newText: string | null }[];
  affectedDepartments: string[];
  results: ImpactResultDto[];
}
