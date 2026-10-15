import { HttpException, HttpStatus } from '@nestjs/common';

export type ContractErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'NO_BASE_VERSION'
  | 'AI_FAILED';

export class ContractHttpException extends HttpException {
  constructor(
    readonly code: ContractErrorCode,
    message: string,
    status: HttpStatus,
  ) {
    super(message, status);
  }
}
