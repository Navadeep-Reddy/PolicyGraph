import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { DependencyNodeType, EdgeRelationship, EdgeStatus } from '../generated/prisma/enums.js';

export class CreateDependencyDto {
  @IsEnum(DependencyNodeType) sourceType!: DependencyNodeType;
  @IsOptional() @IsString() @Matches(/\S/) sourceClauseKey?: string;
  @IsOptional() @IsString() @Matches(/\S/) sourceArtifactId?: string;
  @IsString() @Matches(/\S/) targetArtifactId!: string;
  @IsEnum(EdgeRelationship) relationshipType!: EdgeRelationship;
  @IsOptional() @IsString() @Matches(/\S/) rationale?: string;
}

export class UpdateDependencyDto {
  @IsOptional() @IsEnum(EdgeStatus) status?: EdgeStatus;
  @IsOptional() @IsEnum(EdgeRelationship) relationshipType?: EdgeRelationship;
  @IsOptional() @IsString() @Matches(/\S/) rationale?: string;
}

export class DependencyQueryDto {
  @IsOptional() @IsEnum(EdgeStatus) status?: EdgeStatus;
}

export class DependencySuggestionRequestDto {
  @IsOptional() @IsString() @Matches(/\S/) versionId?: string;
}

export interface DependencySuggestionsDto { created: DependencyDto[]; skipped: number }

export interface DependencyDto {
  id: string; policyId: string; sourceType: DependencyNodeType; sourceClauseKey: string | null;
  sourceArtifactId: string | null; sourceLabel: string; targetArtifactId: string; targetLabel: string;
  relationshipType: EdgeRelationship; status: EdgeStatus; origin: 'AI' | 'MANUAL'; rationale: string | null;
}
