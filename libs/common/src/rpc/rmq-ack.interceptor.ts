import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';
import { Observable, catchError, tap, throwError } from 'rxjs';

/**
 * The queues are configured with `noAck: false`, which means RabbitMQ keeps a
 * message until the handler confirms it. Doing that by hand in every handler
 * is noise, so one global interceptor does it:
 *
 *   handler resolved -> ack, the message is gone for good
 *   handler threw    -> nack WITHOUT requeue
 *
 * No requeue is deliberate. An endlessly redelivered poison message is worse
 * than a lost one, and anything that genuinely needs retrying (email delivery)
 * has its own retry queue with backoff inside the notification service.
 */
@Injectable()
export class RmqAckInterceptor implements NestInterceptor {
  private readonly logger = new Logger('RmqAck');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'rpc') {
      return next.handle();
    }

    const rmqContext = context.switchToRpc().getContext<RmqContext>();
    const channel = rmqContext?.getChannelRef?.();
    const message = rmqContext?.getMessage?.();

    if (!channel || !message) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => channel.ack(message)),
      catchError((error) => {
        this.logger.warn(
          `Handler failed for "${rmqContext.getPattern?.()}", dropping message`,
        );
        channel.nack(message, false, false);
        return throwError(() => error);
      }),
    );
  }
}
