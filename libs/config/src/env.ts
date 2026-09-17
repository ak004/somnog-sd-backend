import * as Joi from 'joi';

/**
 * Every service loads the same root .env. Each one validates only the keys it
 * actually needs, so a missing SMTP host stops the notification service and
 * nothing else.
 */
export const baseSchema = {
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  RABBITMQ_URL: Joi.string().required(),
};

export const gatewayEnvSchema = Joi.object({
  ...baseSchema,
  GATEWAY_PORT: Joi.number().default(3000),
  AUTH_QUEUE: Joi.string().default('auth_queue'),
  EVENTS_QUEUE: Joi.string().default('events_queue'),
  NOTIFICATION_QUEUE: Joi.string().default('notification_queue'),
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),
  APP_WEB_URL: Joi.string().default('http://localhost:4200'),
}).unknown(true);

export const authEnvSchema = Joi.object({
  ...baseSchema,
  AUTH_DATABASE_URL: Joi.string().required(),
  AUTH_QUEUE: Joi.string().default('auth_queue'),
  AUTH_HEALTH_PORT: Joi.number().default(3001),
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('7d'),
}).unknown(true);

export const eventsEnvSchema = Joi.object({
  ...baseSchema,
  EVENTS_DATABASE_URL: Joi.string().required(),
  EVENTS_QUEUE: Joi.string().default('events_queue'),
  EVENTS_HEALTH_PORT: Joi.number().default(3002),
  AUTH_QUEUE: Joi.string().default('auth_queue'),
  DEFAULT_TIMEZONE: Joi.string().default('Africa/Mogadishu'),
}).unknown(true);

export const notificationEnvSchema = Joi.object({
  ...baseSchema,
  NOTIFY_DATABASE_URL: Joi.string().required(),
  NOTIFICATION_QUEUE: Joi.string().default('notification_queue'),
  NOTIFICATION_HEALTH_PORT: Joi.number().default(3003),
  AUTH_QUEUE: Joi.string().default('auth_queue'),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  SMTP_HOST: Joi.string().default('localhost'),
  SMTP_PORT: Joi.number().default(1025),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASSWORD: Joi.string().allow('').optional(),
  MAIL_FROM: Joi.string().default('SomNOG Events <no-reply@somnog.so>'),
  APP_WEB_URL: Joi.string().default('http://localhost:4200'),
}).unknown(true);

/** Root .env, resolved from any app directory. */
export const ENV_FILE_PATHS = ['.env', '../../.env', '../../../.env'];
