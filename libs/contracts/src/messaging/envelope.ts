import { randomUUID } from 'node:crypto';

/**
 * Every message on the bus - RPC or event - carries the same wrapper, so
 * logging, tracing and idempotency work identically in every service.
 */
export interface Message<T = unknown> {
  /** Generated at the gateway, logged by every hop of one request. */
  correlationId: string;
  /** Unique per message. Consumers use it as an idempotency key. */
  eventId: string;
  /** ISO-8601 UTC. */
  occurredAt: string;
  /** Bump only for breaking payload changes. */
  version: number;
  /** Who is making the call, when the caller is acting for a user. */
  actor?: MessageActor;
  data: T;
}

export interface MessageActor {
  userId: string;
  email?: string;
  role?: string;
}

export function buildMessage<T>(
  data: T,
  options: {
    correlationId?: string;
    actor?: MessageActor;
    version?: number;
  } = {},
): Message<T> {
  return {
    correlationId: options.correlationId ?? randomUUID(),
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    version: options.version ?? 1,
    actor: options.actor,
    data,
  };
}

/**
 * Accepts either a wrapped message or a bare payload.
 *
 * Student services sometimes send bare payloads while they are learning; this
 * keeps the receiving side from blowing up and makes the envelope adoptable
 * one service at a time.
 */
export function unwrap<T>(input: Message<T> | T): T {
  if (
    input &&
    typeof input === 'object' &&
    'data' in (input as Record<string, unknown>) &&
    'eventId' in (input as Record<string, unknown>)
  ) {
    return (input as Message<T>).data;
  }
  return input as T;
}

export function messageMeta(
  input: unknown,
): Pick<Message, 'correlationId' | 'eventId' | 'occurredAt'> | null {
  if (input && typeof input === 'object' && 'eventId' in input) {
    const m = input as Message;
    return {
      correlationId: m.correlationId,
      eventId: m.eventId,
      occurredAt: m.occurredAt,
    };
  }
  return null;
}
