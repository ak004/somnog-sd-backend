import { TEMPLATE_KEYS } from '@somnog/contracts';

interface TemplateSource {
  subject: string;
  body: string;
}

const layout = (content: string) => `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
  <div style="border-bottom:2px solid #0b5fff;padding-bottom:12px;margin-bottom:24px">
    <strong style="font-size:18px">SomNOG Events</strong>
    <span style="color:#666;font-size:13px"> &middot; SomaliREN</span>
  </div>
  ${content}
  <p style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;color:#888;font-size:12px">
    You are receiving this because you have an account on the SomNOG event system.
  </p>
</div>`;

/**
 * Shipped defaults. The database copy wins when one exists, so an organiser
 * can reword any of these without a deploy.
 */
export const DEFAULT_TEMPLATES: Record<string, TemplateSource> = {
  [TEMPLATE_KEYS.WELCOME_VERIFY_EMAIL]: {
    subject: 'Confirm your SomNOG events account',
    body: layout(`
      <p>Hello {{firstName}},</p>
      <p>Thanks for creating an account. Confirm your email address to finish signing up:</p>
      <p><a href="{{verifyUrl}}" style="background:#0b5fff;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Confirm my email</a></p>
      <p style="color:#666;font-size:13px">Or paste this link into your browser:<br>{{verifyUrl}}</p>
      <p style="color:#666;font-size:13px">The link is valid for 24 hours.</p>`),
  },

  [TEMPLATE_KEYS.PASSWORD_RESET]: {
    subject: 'Reset your SomNOG events password',
    body: layout(`
      <p>Hello {{firstName}},</p>
      <p>Someone asked to reset the password on your account. If that was you, choose a new one:</p>
      <p><a href="{{resetUrl}}" style="background:#0b5fff;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Set a new password</a></p>
      <p style="color:#666;font-size:13px">This link expires in one hour. If it was not you, nothing has changed and you can ignore this email.</p>`),
  },

  [TEMPLATE_KEYS.PASSWORD_CHANGED]: {
    subject: 'Your password was changed',
    body: layout(`
      <p>Hello {{firstName}},</p>
      <p>Your password was just changed and every session has been signed out.</p>
      <p style="color:#666;font-size:13px">If this was not you, reset your password immediately and contact the organisers.</p>`),
  },

  [TEMPLATE_KEYS.REGISTRATION_TICKET]: {
    subject: 'You are registered for {{eventTitle}}',
    body: layout(`
      <p>Hello {{firstName}},</p>
      <p>Your place at <strong>{{eventTitle}}</strong>{{#if sessionTitle}} &mdash; {{sessionTitle}}{{/if}} is confirmed.</p>
      <table style="margin:20px 0;font-size:14px">
        <tr><td style="padding:4px 16px 4px 0;color:#666">Ticket</td><td><strong style="font-family:monospace;font-size:16px">{{ticketCode}}</strong></td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#666">Starts</td><td>{{eventStartsAt}}</td></tr>
        {{#if venue}}<tr><td style="padding:4px 16px 4px 0;color:#666">Venue</td><td>{{venue}}</td></tr>{{/if}}
      </table>
      <p>Bring this ticket code with you &mdash; the registration desk will scan it on arrival.</p>`),
  },

  [TEMPLATE_KEYS.REGISTRATION_WAITLISTED]: {
    subject: 'You are on the waiting list for {{eventTitle}}',
    body: layout(`
      <p>Hello {{firstName}},</p>
      <p><strong>{{eventTitle}}</strong>{{#if sessionTitle}} &mdash; {{sessionTitle}}{{/if}} is currently full, so you have been added to the waiting list at position <strong>{{position}}</strong>.</p>
      <p>If somebody cancels we will confirm your place automatically and send your ticket.</p>`),
  },

  [TEMPLATE_KEYS.REGISTRATION_CANCELLED]: {
    subject: 'Your registration for {{eventTitle}} was cancelled',
    body: layout(`
      <p>Hello {{firstName}},</p>
      <p>Your registration for <strong>{{eventTitle}}</strong> has been cancelled.</p>
      <p style="color:#666;font-size:13px">If this was not what you intended, you can register again while places remain.</p>`),
  },

  [TEMPLATE_KEYS.REGISTRATION_REJECTED]: {
    subject: 'About your registration for {{eventTitle}}',
    body: layout(`
      <p>Hello {{firstName}},</p>
      <p>The organisers were unable to approve your registration for <strong>{{eventTitle}}</strong>.</p>
      {{#if reason}}<p style="background:#f6f6f6;padding:12px;border-radius:6px">{{reason}}</p>{{/if}}
      <p style="color:#666;font-size:13px">Reply to the organisers if you think this was a mistake.</p>`),
  },

  [TEMPLATE_KEYS.EVENT_ANNOUNCEMENT]: {
    subject: 'New event: {{title}}',
    body: layout(`
      <p><strong>{{title}}</strong> has just been announced in {{categoryName}}.</p>
      <table style="margin:16px 0;font-size:14px">
        <tr><td style="padding:4px 16px 4px 0;color:#666">Starts</td><td>{{startsAt}}</td></tr>
        {{#if venue}}<tr><td style="padding:4px 16px 4px 0;color:#666">Venue</td><td>{{venue}}</td></tr>{{/if}}
      </table>
      <p><a href="{{eventUrl}}" style="background:#0b5fff;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">View the event</a></p>`),
  },

  [TEMPLATE_KEYS.EVENT_REMINDER]: {
    subject: 'Tomorrow: {{title}}',
    body: layout(`
      <p>Hello {{firstName}},</p>
      <p><strong>{{title}}</strong> starts tomorrow at {{startsAt}}{{#if venue}}, at {{venue}}{{/if}}.</p>
      <p>Your ticket code is <strong style="font-family:monospace">{{ticketCode}}</strong>.</p>
      <p>See you there.</p>`),
  },

  [TEMPLATE_KEYS.EVENT_CANCELLED]: {
    subject: '{{title}} has been cancelled',
    body: layout(`
      <p>Hello {{firstName}},</p>
      <p>We are sorry to say that <strong>{{title}}</strong> has been cancelled.</p>
      {{#if reason}}<p style="background:#f6f6f6;padding:12px;border-radius:6px">{{reason}}</p>{{/if}}
      <p style="color:#666;font-size:13px">No action is needed from you. Any place you held has been released.</p>`),
  },
};
