/**
 * Enum values duplicated in each service's Prisma schema. Prisma generates its
 * own types per service; these are the wire values every service agrees on.
 */

export enum UserRole {
  ADMIN = 'ADMIN',
  ORGANIZER = 'ORGANIZER',
  SPEAKER = 'SPEAKER',
  ATTENDEE = 'ATTENDEE',
}

export enum EventType {
  LECTURE = 'LECTURE',
  MEETING = 'MEETING',
  CONFERENCE = 'CONFERENCE',
}

export enum EventStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CANCELLED = 'CANCELLED',
  ARCHIVED = 'ARCHIVED',
}

export enum EventVisibility {
  PUBLIC = 'PUBLIC',
  UNLISTED = 'UNLISTED',
  PRIVATE = 'PRIVATE',
}

export enum EventRoleType {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  REVIEWER = 'REVIEWER',
}

export enum RegistrationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  WAITLISTED = 'WAITLISTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  CHECKED_IN = 'CHECKED_IN',
}

export enum FormFieldType {
  TEXT = 'TEXT',
  TEXTAREA = 'TEXTAREA',
  NUMBER = 'NUMBER',
  SELECT = 'SELECT',
  MULTISELECT = 'MULTISELECT',
  CHECKBOX = 'CHECKBOX',
  DATE = 'DATE',
  FILE = 'FILE',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  IN_APP = 'IN_APP',
}

export enum NotificationStatus {
  QUEUED = 'QUEUED',
  SENDING = 'SENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

export enum VerificationTokenType {
  EMAIL_VERIFY = 'EMAIL_VERIFY',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

/** Template keys the notification service ships with. */
export const TEMPLATE_KEYS = {
  WELCOME_VERIFY_EMAIL: 'welcome_verify_email',
  PASSWORD_RESET: 'password_reset',
  PASSWORD_CHANGED: 'password_changed',
  REGISTRATION_TICKET: 'registration_ticket',
  REGISTRATION_WAITLISTED: 'registration_waitlisted',
  REGISTRATION_CANCELLED: 'registration_cancelled',
  REGISTRATION_REJECTED: 'registration_rejected',
  EVENT_ANNOUNCEMENT: 'event_announcement',
  EVENT_REMINDER: 'event_reminder',
  EVENT_CANCELLED: 'event_cancelled',
} as const;
