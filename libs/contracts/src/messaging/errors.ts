/**
 * Stable error codes. Services throw these; the gateway maps them to HTTP.
 *
 * A service must never import an HTTP status code - that is the gateway's job.
 */
export const ERROR_CODES = {
  // generic
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  CONFLICT: 'CONFLICT',
  INTERNAL: 'INTERNAL',

  // auth
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_REVOKED: 'TOKEN_REVOKED',

  // events
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  EVENT_NOT_PUBLISHED: 'EVENT_NOT_PUBLISHED',
  EVENT_CANCELLED: 'EVENT_CANCELLED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
  SLUG_TAKEN: 'SLUG_TAKEN',

  // registration
  REGISTRATION_CLOSED: 'REGISTRATION_CLOSED',
  REGISTRATION_NOT_OPEN_YET: 'REGISTRATION_NOT_OPEN_YET',
  ALREADY_REGISTERED: 'ALREADY_REGISTERED',
  EVENT_AT_CAPACITY: 'EVENT_AT_CAPACITY',
  SESSION_AT_CAPACITY: 'SESSION_AT_CAPACITY',
  REGISTRATION_NOT_FOUND: 'REGISTRATION_NOT_FOUND',
  INVALID_TICKET: 'INVALID_TICKET',
  ALREADY_CHECKED_IN: 'ALREADY_CHECKED_IN',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',

  // notifications
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  DELIVERY_FAILED: 'DELIVERY_FAILED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface ServiceErrorShape {
  code: ErrorCode | string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Thrown inside a service, serialized over RabbitMQ, re-hydrated by the
 * gateway's RPC exception filter.
 */
export class ServiceError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode | string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.details = details;
  }

  toJSON(): ServiceErrorShape {
    return { code: this.code, message: this.message, details: this.details };
  }
}

export function isServiceErrorShape(
  value: unknown,
): value is ServiceErrorShape {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as ServiceErrorShape).code === 'string' &&
    typeof (value as ServiceErrorShape).message === 'string'
  );
}

/** Single place mapping domain error codes to HTTP status. Used by the gateway. */
export const ERROR_HTTP_STATUS: Record<string, number> = {
  [ERROR_CODES.VALIDATION_FAILED]: 400,
  [ERROR_CODES.REQUIRED_FIELD_MISSING]: 400,
  [ERROR_CODES.INVALID_TICKET]: 400,
  [ERROR_CODES.UNAUTHORIZED]: 401,
  [ERROR_CODES.INVALID_CREDENTIALS]: 401,
  [ERROR_CODES.TOKEN_INVALID]: 401,
  [ERROR_CODES.TOKEN_EXPIRED]: 401,
  [ERROR_CODES.TOKEN_REVOKED]: 401,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.ACCOUNT_DISABLED]: 403,
  [ERROR_CODES.EMAIL_NOT_VERIFIED]: 403,
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.EVENT_NOT_FOUND]: 404,
  [ERROR_CODES.SESSION_NOT_FOUND]: 404,
  [ERROR_CODES.CATEGORY_NOT_FOUND]: 404,
  [ERROR_CODES.REGISTRATION_NOT_FOUND]: 404,
  [ERROR_CODES.TEMPLATE_NOT_FOUND]: 404,
  [ERROR_CODES.CONFLICT]: 409,
  [ERROR_CODES.EMAIL_TAKEN]: 409,
  [ERROR_CODES.SLUG_TAKEN]: 409,
  [ERROR_CODES.ALREADY_REGISTERED]: 409,
  [ERROR_CODES.ALREADY_CHECKED_IN]: 409,
  [ERROR_CODES.EVENT_AT_CAPACITY]: 409,
  [ERROR_CODES.SESSION_AT_CAPACITY]: 409,
  [ERROR_CODES.REGISTRATION_CLOSED]: 409,
  [ERROR_CODES.REGISTRATION_NOT_OPEN_YET]: 409,
  [ERROR_CODES.EVENT_NOT_PUBLISHED]: 409,
  [ERROR_CODES.EVENT_CANCELLED]: 409,
  [ERROR_CODES.DELIVERY_FAILED]: 502,
  [ERROR_CODES.INTERNAL]: 500,
};
