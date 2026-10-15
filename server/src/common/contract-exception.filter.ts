import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ContractHttpException, type ContractErrorCode } from './contract-http.exception.js';

@Catch()
export class ContractExceptionFilter implements ExceptionFilter {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ContractErrorCode | string = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';

    if (exception instanceof ContractHttpException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();
      const rawMessage = typeof responseBody === 'string'
        ? responseBody
        : (responseBody as { message?: unknown }).message;
      if (status === HttpStatus.BAD_REQUEST) {
        code = 'VALIDATION_ERROR';
        message = this.messageString(rawMessage);
      } else if (status === HttpStatus.NOT_FOUND) {
        code = 'NOT_FOUND';
        message = this.messageString(rawMessage);
      } else if (status === HttpStatus.CONFLICT) {
        code = 'CONFLICT';
        message = this.messageString(rawMessage);
      } else if (status === HttpStatus.BAD_GATEWAY) {
        code = 'AI_FAILED';
        message = this.messageString(rawMessage);
      } else {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
      }
    }

    this.adapterHost.httpAdapter.reply(
      response,
      { error: { code, message } },
      status,
    );
  }

  private messageString(value: unknown): string {
    if (Array.isArray(value)) {
      const messages = value.filter((item): item is string => typeof item === 'string').sort();
      return messages.join('; ') || 'Request validation failed';
    }
    return typeof value === 'string' && value.length > 0 ? value : 'Request failed';
  }
}
