/**
 * RPC message patterns: `<service>.<entity>.<action>`.
 *
 * A pattern is a QUESTION addressed to exactly one service. The caller waits
 * for the answer (`client.send()` -> `@MessagePattern()`).
 *
 * If you are tempted to add a pattern that performs a side effect nobody is
 * waiting for, publish an EVENT instead - see ./events.ts.
 */
export const AUTH_PATTERNS = {
  REGISTER: 'auth.user.register',
  LOGIN: 'auth.user.login',
  REFRESH: 'auth.token.refresh',
  LOGOUT: 'auth.token.logout',
  VERIFY_TOKEN: 'auth.token.verify',
  VERIFY_EMAIL: 'auth.user.verify_email',
  FORGOT_PASSWORD: 'auth.user.forgot_password',
  RESET_PASSWORD: 'auth.user.reset_password',
  CHANGE_PASSWORD: 'auth.user.change_password',
  FIND_BY_ID: 'auth.user.find_by_id',
  FIND_MANY_BY_IDS: 'auth.user.find_many_by_ids',
  UPDATE_PROFILE: 'auth.user.update_profile',
  LIST_USERS: 'auth.user.list',
  SET_ROLE: 'auth.user.set_role',
} as const;

export const EVENTS_PATTERNS = {
  // categories
  CATEGORY_TREE: 'events.category.tree',
  CATEGORY_FIND: 'events.category.find',
  CATEGORY_CREATE: 'events.category.create',
  CATEGORY_UPDATE: 'events.category.update',

  // events
  EVENT_LIST: 'events.event.list',
  EVENT_FIND: 'events.event.find',
  EVENT_FIND_BY_ID: 'events.event.find_by_id',
  EVENT_CREATE: 'events.event.create',
  EVENT_UPDATE: 'events.event.update',
  EVENT_PUBLISH: 'events.event.publish',
  EVENT_CANCEL: 'events.event.cancel',

  // sessions (workshop tracks inside an event)
  SESSION_LIST: 'events.session.list',
  SESSION_CREATE: 'events.session.create',
  SESSION_UPDATE: 'events.session.update',
  SESSION_DELETE: 'events.session.delete',

  // registration forms - one per event, optionally one per workshop track
  FORM_GET: 'events.form.get',
  FORM_UPSERT: 'events.form.upsert',
  SESSION_FORM_GET: 'events.session_form.get',
  SESSION_FORM_UPSERT: 'events.session_form.upsert',

  // registrations
  REGISTRATION_CREATE: 'events.registration.create',
  REGISTRATION_LIST_BY_EVENT: 'events.registration.list_by_event',
  REGISTRATION_LIST_BY_USER: 'events.registration.list_by_user',
  REGISTRATION_APPROVE: 'events.registration.approve',
  REGISTRATION_REJECT: 'events.registration.reject',
  REGISTRATION_CANCEL: 'events.registration.cancel',
  REGISTRATION_CHECK_IN: 'events.registration.check_in',
  REGISTRATION_COUNT_BY_EVENT: 'events.registration.count_by_event',
} as const;

export const NOTIFICATION_PATTERNS = {
  LIST_FOR_USER: 'notify.notification.list_for_user',
  MARK_READ: 'notify.notification.mark_read',
  LIST_ALL: 'notify.notification.list_all',
  RETRY: 'notify.notification.retry',
  PREFERENCES_GET: 'notify.preference.get',
  PREFERENCES_UPDATE: 'notify.preference.update',
  TEMPLATE_LIST: 'notify.template.list',
  TEMPLATE_UPSERT: 'notify.template.upsert',
  SEND_DIRECT: 'notify.notification.send_direct',
} as const;
