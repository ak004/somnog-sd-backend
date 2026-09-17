// Messaging: the contract between services.
export * from './messaging/patterns';
export * from './messaging/events';
export * from './messaging/envelope';
export * from './messaging/errors';

// Shared vocabulary.
export * from './common/enums';
export * from './common/pagination.dto';

// Per-service payloads.
export * from './auth/auth.dto';
export * from './events/event.dto';
export * from './events/registration.dto';
export * from './notifications/notification.dto';
