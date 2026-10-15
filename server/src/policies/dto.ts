import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { ClauseChangeType } from './change-classifier.js';

// PATCH /versions/:versionId/clauses/:clauseId request body.
export class UpdateClauseDto {
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(10000)
  text?: string;

  @IsOptional()
  @IsString()
  @Matches(/\S/)
  title?: string;

  @IsOptional()
  @IsString()
  @Matches(/\S/)
  category?: string;
}

export class CreateClauseDto {
  @IsString() @Matches(/\S/) stableKey!: string;
  @IsString() @Matches(/\S/) title!: string;
  @IsString() @Matches(/\S/) @MaxLength(10000) text!: string;
  @IsString() @Matches(/\S/) category!: string;
}

export class CreatePolicyDto {
  @IsString()
  @Matches(/\S/)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @Matches(/\S/)
  text!: string;
}

export class CreateRevisionDto {
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  text?: string;
}

export class VersionChangesQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  against?: string;
}

export interface CreatePolicyResponseDto {
  policy: PolicyDetailDto;
  draft: VersionDetailDto;
}

export interface ClauseDto {
  id: string;
  policyVersionId: string;
  stableKey: string;
  text: string;
  position: number;
  textHash: string;
}

export interface VersionClauseDto {
  id: string;
  versionId: string;
  stableKey: string;
  title: string;
  text: string;
  category: string;
  position: number;
}

export interface VersionDto {
  id: string;
  policyId: string;
  versionNumber: number;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  publishedAt: string | null;
  createdAt: string;
}

export interface VersionDetailDto extends VersionDto {
  clauses: VersionClauseDto[];
}

export interface PolicySummaryDto {
  id: string;
  title: string;
  description: string | null;
  activeVersionNumber: number | null;
  draftVersionId: string | null;
  activeVersionId: string | null;
  approvedDependencyCount: number;
  latestImpactRunId: string | null;
  updatedAt: string;
}

export interface PolicyDetailDto {
  id: string;
  title: string;
  description: string | null;
  versions: VersionDto[];
}

export interface ClauseChangeDto {
  stableKey: string;
  changeType: ClauseChangeType;
  activeClause: ClauseDto | null;
  draftClause: ClauseDto | null;
}

export interface VersionClauseChangeDto {
  stableKey: string;
  changeType: ClauseChangeType;
  before: VersionClauseDto | null;
  after: VersionClauseDto | null;
}
