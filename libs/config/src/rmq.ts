import {
  ClientProviderOptions,
  MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';

/**
 * Every service shares ONE topic exchange (`somnog.events`).
 *
 * Each service still owns its own durable queue, and Nest binds that queue to
 * the exchange using the patterns the service actually handles as routing
 * keys. Two consequences worth understanding:
 *
 *  - RPC (`auth.user.login`) is routed to exactly the one queue that declared
 *    that pattern, so it behaves like a direct call.
 *  - An event (`registration.confirmed`) reaches EVERY queue bound to that
 *    routing key. A student service that declares `@EventPattern('registration.confirmed')`
 *    starts receiving it without one line changing in the events service.
 *
 * That is the whole reason for the exchange: publishers must not know their
 * consumers.
 */
export const EVENTS_EXCHANGE = 'somnog.events';

/** Server side: how a microservice listens. */
export function rmqServerOptions(
  url: string,
  queue: string,
  exchange: string = EVENTS_EXCHANGE,
): MicroserviceOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [url],
      queue,
      exchange,
      exchangeType: 'topic',
      // Bind this queue to the exchange using the registered patterns.
      wildcards: true,
      // A message leaves the queue only once the handler finishes. Kill a
      // service mid-handler and RabbitMQ redelivers - which is exactly why
      // consumers must be idempotent (see the notification service).
      noAck: false,
      prefetchCount: 10,
      queueOptions: { durable: true },
      socketOptions: { heartbeatIntervalInSeconds: 10 },
    },
  };
}

/** Client side: how a service publishes or calls. */
export function rmqClientOptions(
  name: string,
  url: string,
  queue: string,
  exchange: string = EVENTS_EXCHANGE,
): ClientProviderOptions {
  return {
    name,
    transport: Transport.RMQ,
    options: {
      urls: [url],
      queue,
      exchange,
      exchangeType: 'topic',
      wildcards: true,
      queueOptions: { durable: true },
      socketOptions: { heartbeatIntervalInSeconds: 10 },
    },
  };
}

/** Injection tokens for the RabbitMQ clients. */
export const AUTH_CLIENT = 'AUTH_CLIENT';
export const EVENTS_CLIENT = 'EVENTS_CLIENT';
export const NOTIFICATION_CLIENT = 'NOTIFICATION_CLIENT';
/** Used by a service that only publishes domain events. */
export const EVENT_BUS = 'EVENT_BUS';
