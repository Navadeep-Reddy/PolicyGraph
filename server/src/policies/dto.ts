import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { ClauseChangeType } from './change-classifier.js';

// PATCH /versions/:versionId/clauses/:clauseId request body.
export class UpdateClauseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  text!: string;
}

export interface ClauseDto {
  id: string;
  policyVersionId: string;
  stableKey: string;
  text: string;
  position: number;
  textHash: string;
}

export interface VersionSummaryDto {
  id: string;
  policyId: string;
  versionNumber: number;
  status: 'ACTIVE' | 'DRAFT';
  effectiveDate: string | null;
  createdAt: string;
  clauseCount: number;
}

export interface VersionWithClausesDto {
  id: string;
  policyId: string;
  versionNumber: number;
  status: 'ACTIVE' | 'DRAFT';
  effectiveDate: string | null;
  createdAt: string;
  clauses: ClauseDto[];
}

// Dashboard row: GET /policies carries every MVP dashboard field so the
// client renders without follow-up requests.
export interface PolicyListItemDto {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  activeVersion: VersionSummaryDto | null;
  draftVersion: VersionSummaryDto | null;
  approvedDependencyCount: number;
  latestImpactRun: {
    id: string;
    policyVersionId: string;
    createdAt: string;
    resultCount: number;
  } | null;
}

// Policy comparison screen: GET /policies/:id carries active and draft
// clauses for side-by-side display and editing.
export interface PolicyDetailDto {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  activeVersion: VersionWithClausesDto | null;
  draftVersion: VersionWithClausesDto | null;
}

export interface ClauseChangeDto {
  stableKey: string;
  changeType: ClauseChangeType;
  activeClause: ClauseDto | null;
  draftClause: ClauseDto | null;
}

export interface VersionChangesDto {
  versionId: string;
  policyId: string;
  changes: ClauseChangeDto[];
}
