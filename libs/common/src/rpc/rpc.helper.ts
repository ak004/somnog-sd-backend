import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout, catchError, throwError } from 'rxjs';
import {
  buildMessage,
  isServiceErrorShape,
  MessageActor,
  Message,
  ERROR_CODES,
} from '@somnog/contracts';

export interface RpcCallOptions {
  correlationId?: string;
  actor?: MessageActor;
  /** milliseconds; a hung service should fail fast, not hold the request open */
  timeoutMs?: number;
}

/**
 * The one way the gateway makes an RPC call.
 *
 * Wraps the payload in the standard envelope, applies a timeout, and turns a
 * serialized ServiceError back into something the HTTP filter understands.
 */
export async function rpc<TResult, TData = unknown>(
  client: ClientProxy,
  pattern: string,
  data: TData,
  options: RpcCallOptions = {},
): Promise<TResult> {
  const message: Message<TData> = buildMessage(data, {
    correlationId: options.correlationId,
    actor: options.actor,
  });

  return firstValueFrom(
    client.send<TResult, Message<TData>>(pattern, message).pipe(
      timeout(options.timeoutMs ?? 10_000),
      catchError((error) => {
        if (isServiceErrorShape(error)) {
          return throwError(() => error);
        }
        if (error?.name === 'TimeoutError') {
          return throwError(() => ({
            code: ERROR_CODES.INTERNAL,
            message: `Service did not respond in time (${pattern})`,
          }));
        }
        return throwError(() => ({
          code: ERROR_CODES.INTERNAL,
          message: error?.message ?? `RPC call failed (${pattern})`,
        }));
      }),
    ),
  );
}

/**
 * Publishing an event. Fire-and-forget on purpose: the caller must not wait,
 * and must not care whether anyone is listening.
 */
export function publish<T>(
  client: ClientProxy,
  event: string,
  data: T,
  options: { correlationId?: string; actor?: MessageActor } = {},
): void {
  client.emit(event, buildMessage(data, options));
}
