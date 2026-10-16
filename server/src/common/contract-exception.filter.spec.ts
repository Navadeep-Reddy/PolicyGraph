import { BadRequestException, ConflictException, HttpStatus, NotFoundException, BadGatewayException, Logger } from '@nestjs/common';
import { ContractExceptionFilter } from './contract-exception.filter.js';
import { ContractHttpException } from './contract-http.exception.js';

describe('ContractExceptionFilter', () => {
  function map(exception: unknown) {
    const reply = vi.fn();
    const response = {};
    const request = {};
    const host = {
      switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
    } as never;
    const filter = new ContractExceptionFilter({
      httpAdapter: { reply },
    } as never);
    filter.catch(exception, host);
    return reply.mock.calls[0];
  }

  it('normalizes validation message arrays deterministically', () => {
    expect(map(new BadRequestException({ message: ['second', 'first'] }))).toEqual([
      {}, { error: { code: 'VALIDATION_ERROR', message: 'first; second' } }, 400,
    ]);
  });

  it('maps missing resources, conflicts, base version, and AI failures', () => {
    expect(map(new NotFoundException('missing'))?.[1]).toEqual({ error: { code: 'NOT_FOUND', message: 'missing' } });
    expect(map(new ConflictException('conflict'))?.[1]).toEqual({ error: { code: 'CONFLICT', message: 'conflict' } });
    expect(map(new ContractHttpException('NO_BASE_VERSION', 'no base', HttpStatus.CONFLICT))?.[1]).toEqual({ error: { code: 'NO_BASE_VERSION', message: 'no base' } });
    expect(map(new BadGatewayException('AI unavailable'))?.[1]).toEqual({ error: { code: 'AI_FAILED', message: 'AI unavailable' } });
  });

  it('redacts unknown errors', () => {
    expect(map(new Error('secret details'))).toEqual([
      {}, { error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } }, 500,
    ]);
  });

  it('logs only safe unknown-error diagnostics without changing the generic response', () => {
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const exception = Object.assign(new Error('postgresql://secret/db?password=secret'), { code: 'P2028' });
    expect(map(exception)).toEqual([
      {}, { error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } }, 500,
    ]);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^\{"errorClass":"Error","code":"P2028","applicationFrame":"[^"]+\/src\/[^"]+"\}$/));
    expect(log.mock.calls[0][0]).not.toContain('secret');
    log.mockRestore();
  });
});
