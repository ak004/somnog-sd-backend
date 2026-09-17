import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

/** Minimal shape, so this lib does not need the full express typings. */
interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  correlationId?: string;
}
interface ResponseLike {
  setHeader(name: string, value: string): void;
}

/** Read it off any request the gateway has passed through this middleware. */
export function getCorrelationId(req: unknown): string | undefined {
  const r = req as RequestLike | undefined;
  if (!r) return undefined;
  const header = r.headers?.[CORRELATION_ID_HEADER];
  return r.correlationId ?? (Array.isArray(header) ? header[0] : header);
}

/**
 * One id follows a request from the browser through the gateway and into every
 * service it touches. Grep one id in four terminals and you have the whole
 * story of what happened.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: RequestLike, res: ResponseLike, next: () => void) {
    const incoming = req.headers?.[CORRELATION_ID_HEADER];
    const correlationId =
      (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID();

    req.correlationId = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    next();
  }
}
