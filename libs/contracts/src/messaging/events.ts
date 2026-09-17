/**
 * Domain events: `<entity>.<past-tense-verb>`.
 *
 * An event is a FACT that already happened. It is published with
 * `client.emit()` and consumed with `@EventPattern()`. The publisher does not
 * know or care who listens, and nobody replies.
 *
 * Versioning rule: adding an optional field to a payload is free. Removing or
 * renaming one means publishing `<name>.v2` alongside the old pattern until
 * every consumer has moved.
 */
export const DOMAIN_EVENTS = {
  USER_REGISTERED: 'user.registered',
  USER_EMAIL_VERIFIED: 'user.email_verified',
  USER_PASSWORD_RESET_REQUESTED: 'user.password_reset_requested',
  USER_PASSWORD_CHANGED: 'user.password_changed',

  EVENT_PUBLISHED: 'event.published',
  EVENT_CANCELLED: 'event.cancelled',
  EVENT_REMINDER_DUE: 'event.reminder_due',

  REGISTRATION_CONFIRMED: 'registration.confirmed',
  REGISTRATION_WAITLISTED: 'registration.waitlisted',
  REGISTRATION_CANCELLED: 'registration.cancelled',
  REGISTRATION_REJECTED: 'registration.rejected',
  REGISTRATION_CHECKED_IN: 'registration.checked_in',
} as const;

export type DomainEventName =
  (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

// --- payloads -------------------------------------------------------------

export interface UserRegisteredPayload {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  verificationToken: string;
}

export interface UserEmailVerifiedPayload {
  userId: string;
  email: string;
  firstName: string;
}

export interface PasswordResetRequestedPayload {
  userId: string;
  email: string;
  firstName: string;
  resetToken: string;
}

export interface PasswordChangedPayload {
  userId: string;
  email: string;
  firstName: string;
}

export interface EventPublishedPayload {
  eventId: string;
  title: string;
  slug: string;
  type: string;
  categoryId: string;
  categoryName: string;
  startsAt: string;
  endsAt: string;
  venue: string | null;
}

export interface EventCancelledPayload {
  eventId: string;
  title: string;
  reason: string | null;
  affectedUserIds: string[];
}

export interface EventReminderDuePayload {
  eventId: string;
  title: string;
  startsAt: string;
  venue: string | null;
  recipients: Array<{ userId: string; registrationId: string }>;
}

export interface RegistrationConfirmedPayload {
  registrationId: string;
  userId: string;
  eventId: string;
  eventTitle: string;
  eventStartsAt: string;
  sessionId: string | null;
  sessionTitle: string | null;
  ticketCode: string;
  venue: string | null;
}

export interface RegistrationWaitlistedPayload {
  registrationId: string;
  userId: string;
  eventId: string;
  eventTitle: string;
  sessionId: string | null;
  position: number;
}

export interface RegistrationCancelledPayload {
  registrationId: string;
  userId: string;
  eventId: string;
  eventTitle: string;
  cancelledBy: 'USER' | 'ORGANIZER';
}

export interface RegistrationRejectedPayload {
  registrationId: string;
  userId: string;
  eventId: string;
  eventTitle: string;
  reason: string | null;
}

export interface RegistrationCheckedInPayload {
  registrationId: string;
  userId: string;
  eventId: string;
  checkedInAt: string;
}

/** Maps every event name to its payload, so consumers get real type safety. */
export interface DomainEventPayloadMap {
  [DOMAIN_EVENTS.USER_REGISTERED]: UserRegisteredPayload;
  [DOMAIN_EVENTS.USER_EMAIL_VERIFIED]: UserEmailVerifiedPayload;
  [DOMAIN_EVENTS.USER_PASSWORD_RESET_REQUESTED]: PasswordResetRequestedPayload;
  [DOMAIN_EVENTS.USER_PASSWORD_CHANGED]: PasswordChangedPayload;
  [DOMAIN_EVENTS.EVENT_PUBLISHED]: EventPublishedPayload;
  [DOMAIN_EVENTS.EVENT_CANCELLED]: EventCancelledPayload;
  [DOMAIN_EVENTS.EVENT_REMINDER_DUE]: EventReminderDuePayload;
  [DOMAIN_EVENTS.REGISTRATION_CONFIRMED]: RegistrationConfirmedPayload;
  [DOMAIN_EVENTS.REGISTRATION_WAITLISTED]: RegistrationWaitlistedPayload;
  [DOMAIN_EVENTS.REGISTRATION_CANCELLED]: RegistrationCancelledPayload;
  [DOMAIN_EVENTS.REGISTRATION_REJECTED]: RegistrationRejectedPayload;
  [DOMAIN_EVENTS.REGISTRATION_CHECKED_IN]: RegistrationCheckedInPayload;
}
