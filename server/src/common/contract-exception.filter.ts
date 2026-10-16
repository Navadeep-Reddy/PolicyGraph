import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ContractHttpException, type ContractErrorCode } from './contract-http.exception.js';

@Catch()
export class ContractExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ContractExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ContractErrorCode | string = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';

    if (!(exception instanceof HttpException)) {
      this.logUnknownError(exception);
    }

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

  private logUnknownError(exception: unknown): void {
    const error = typeof exception === 'object' && exception !== null ? exception as Record<string, unknown> : {};
    const rawClass = exception instanceof Error ? exception.constructor.name : 'UnknownError';
    const errorClass = /^[A-Za-z0-9_$]+$/.test(rawClass) ? rawClass : 'UnknownError';
    const rawCode = error['code'];
    const code = typeof rawCode === 'string' && /^[A-Z0-9_]+$/.test(rawCode) ? rawCode : undefined;
    const stack = exception instanceof Error ? exception.stack : undefined;
    const applicationFrame = stack?.split('\n')
      .map((line) => line.match(/(?:file:\/\/)?[^\s()]*\/src\/[^\s()]+:\d+:\d+/)?.[0])
      .find((location) => location !== undefined);

    this.logger.error(JSON.stringify({ errorClass, ...(code ? { code } : {}), ...(applicationFrame ? { applicationFrame } : {}) }));
  }
}
