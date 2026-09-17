import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ERROR_CODES,
  ERROR_HTTP_STATUS,
  isServiceErrorShape,
} from '@somnog/contracts';

/**
 * Used on the GATEWAY. Every error - thrown locally or bubbled up from a
 * service over RabbitMQ - leaves as the same JSON envelope.
 */
@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId =
      (request as any).correlationId ??
      (request.headers['x-correlation-id'] as string) ??
      null;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ERROR_CODES.INTERNAL;
    let message = 'Unexpected error';
    let details: unknown;

    if (isServiceErrorShape(exception)) {
      // Came back from a microservice.
      code = exception.code;
      message = exception.message;
      details = exception.details;
      status = ERROR_HTTP_STATUS[code] ?? HttpStatus.BAD_REQUEST;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else {
        const obj = body as Record<string, unknown>;
        message = (obj.message as string) ?? exception.message;
        details = obj.errors ?? (Array.isArray(obj.message) ? obj.message : undefined);
      }
      code = this.statusToCode(status);
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.message, exception.stack);
    }

    if (status >= 500) {
      this.logger.error(
        `[${correlationId}] ${request.method} ${request.url} -> ${code}: ${message}`,
      );
    }

    response.status(status).json({
      error: { code, message, ...(details ? { details } : {}) },
      correlationId,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private statusToCode(status: number): string {
    switch (status) {
      case 400:
        return ERROR_CODES.VALIDATION_FAILED;
      case 401:
        return ERROR_CODES.UNAUTHORIZED;
      case 403:
        return ERROR_CODES.FORBIDDEN;
      case 404:
        return ERROR_CODES.NOT_FOUND;
      case 409:
        return ERROR_CODES.CONFLICT;
      default:
        return ERROR_CODES.INTERNAL;
    }
  }
}
