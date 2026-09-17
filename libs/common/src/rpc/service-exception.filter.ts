import {
  ArgumentsHost,
  Catch,
  Logger,
  RpcExceptionFilter,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';
import {
  ERROR_CODES,
  ServiceError,
  ServiceErrorShape,
} from '@somnog/contracts';

/**
 * Used INSIDE each microservice. Turns whatever was thrown into the one wire
 * shape the gateway knows how to read: { code, message, details? }.
 *
 * Services never think about HTTP status codes - the gateway maps the code.
 */
@Catch()
export class ServiceExceptionFilter implements RpcExceptionFilter {
  private readonly logger = new Logger('RpcException');

  catch(exception: unknown, _host: ArgumentsHost): Observable<never> {
    const shape = this.toShape(exception);

    if (shape.code === ERROR_CODES.INTERNAL) {
      this.logger.error(shape.message, (exception as Error)?.stack);
    } else {
      this.logger.warn(`${shape.code}: ${shape.message}`);
    }

    return throwError(() => new RpcException(shape).getError());
  }

  private toShape(exception: unknown): ServiceErrorShape {
    if (exception instanceof ServiceError) {
      return exception.toJSON();
    }

    if (exception instanceof RpcException) {
      const err = exception.getError();
      if (typeof err === 'object' && err !== null && 'code' in err) {
        return err as ServiceErrorShape;
      }
      return { code: ERROR_CODES.INTERNAL, message: String(err) };
    }

    // Prisma unique-constraint violation, surfaced as a conflict.
    const prismaCode = (exception as { code?: string })?.code;
    if (prismaCode === 'P2002') {
      return {
        code: ERROR_CODES.CONFLICT,
        message: 'A record with that value already exists',
        details: { target: (exception as any)?.meta?.target },
      };
    }
    if (prismaCode === 'P2025') {
      return { code: ERROR_CODES.NOT_FOUND, message: 'Record not found' };
    }

    return {
      code: ERROR_CODES.INTERNAL,
      message:
        exception instanceof Error ? exception.message : 'Unexpected error',
    };
  }
}
