/**
 * Every delivery channel implements this and nothing more.
 *
 * Adding SMS (which reaches further than email in Somalia) means writing one
 * more class here - the consumers, templates and retry queue do not change.
 * That is a good exercise for a student team.
 */
export interface RenderedMessage {
  recipient: string;
  subject: string;
  body: string;
}

export interface NotificationChannelAdapter {
  readonly name: 'EMAIL' | 'SMS' | 'IN_APP';
  send(message: RenderedMessage): Promise<void>;
}
