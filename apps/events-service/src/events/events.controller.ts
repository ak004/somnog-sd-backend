import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CancelEventDto,
  CreateEventDto,
  CreateSessionDto,
  EVENTS_PATTERNS,
  ListEventsQueryDto,
  Message,
  UpdateEventDto,
  UpdateSessionDto,
  UpsertRegistrationFormDto,
  UserRole,
  unwrap,
} from '@somnog/contracts';
import { EventsService } from './events.service';

/** Present on every write; the gateway fills it from the verified JWT. */
type WithActor<T> = T & { actorId: string; actorRole: UserRole };

const actorOf = <T>(payload: WithActor<T>) => ({
  userId: payload.actorId,
  role: payload.actorRole,
});

@Controller()
export class EventsMessageController {
  constructor(private readonly events: EventsService) {}

  @MessagePattern(EVENTS_PATTERNS.EVENT_LIST)
  list(@Payload() message: Message<ListEventsQueryDto>) {
    return this.events.list(unwrap(message) ?? {});
  }

  @MessagePattern(EVENTS_PATTERNS.EVENT_FIND)
  find(@Payload() message: Message<{ slug: string }>) {
    return this.events.findBySlug(unwrap(message).slug);
  }

  @MessagePattern(EVENTS_PATTERNS.EVENT_FIND_BY_ID)
  findById(@Payload() message: Message<{ eventId: string }>) {
    return this.events.findById(unwrap(message).eventId);
  }

  @MessagePattern(EVENTS_PATTERNS.EVENT_CREATE)
  create(@Payload() message: Message<WithActor<CreateEventDto>>) {
    const payload = unwrap(message);
    const { actorId, actorRole, ...dto } = payload;
    return this.events.create(dto, actorOf(payload));
  }

  @MessagePattern(EVENTS_PATTERNS.EVENT_UPDATE)
  update(
    @Payload() message: Message<WithActor<UpdateEventDto & { eventId: string }>>,
  ) {
    const payload = unwrap(message);
    const { actorId, actorRole, eventId, ...dto } = payload;
    return this.events.update(eventId, dto, actorOf(payload));
  }

  @MessagePattern(EVENTS_PATTERNS.EVENT_PUBLISH)
  publish(@Payload() message: Message<WithActor<{ eventId: string }>>) {
    const payload = unwrap(message);
    return this.events.publish(
      payload.eventId,
      actorOf(payload),
      message.correlationId,
    );
  }

  @MessagePattern(EVENTS_PATTERNS.EVENT_CANCEL)
  cancel(
    @Payload() message: Message<WithActor<CancelEventDto & { eventId: string }>>,
  ) {
    const payload = unwrap(message);
    const { actorId, actorRole, eventId, ...dto } = payload;
    return this.events.cancel(
      eventId,
      dto,
      actorOf(payload),
      message.correlationId,
    );
  }

  // --- sessions -----------------------------------------------------------

  @MessagePattern(EVENTS_PATTERNS.SESSION_LIST)
  listSessions(@Payload() message: Message<{ eventId: string }>) {
    return this.events.listSessions(unwrap(message).eventId);
  }

  @MessagePattern(EVENTS_PATTERNS.SESSION_CREATE)
  createSession(
    @Payload()
    message: Message<WithActor<CreateSessionDto & { eventId: string }>>,
  ) {
    const payload = unwrap(message);
    const { actorId, actorRole, eventId, ...dto } = payload;
    return this.events.createSession(eventId, dto, actorOf(payload));
  }

  @MessagePattern(EVENTS_PATTERNS.SESSION_UPDATE)
  updateSession(
    @Payload()
    message: Message<WithActor<UpdateSessionDto & { sessionId: string }>>,
  ) {
    const payload = unwrap(message);
    const { actorId, actorRole, sessionId, ...dto } = payload;
    return this.events.updateSession(sessionId, dto, actorOf(payload));
  }

  @MessagePattern(EVENTS_PATTERNS.SESSION_DELETE)
  deleteSession(@Payload() message: Message<WithActor<{ sessionId: string }>>) {
    const payload = unwrap(message);
    return this.events.deleteSession(payload.sessionId, actorOf(payload));
  }

  // --- registration form --------------------------------------------------

  @MessagePattern(EVENTS_PATTERNS.FORM_GET)
  getForm(@Payload() message: Message<{ eventId: string }>) {
    return this.events.getForm(unwrap(message).eventId);
  }

  @MessagePattern(EVENTS_PATTERNS.SESSION_FORM_GET)
  getSessionForm(@Payload() message: Message<{ sessionId: string }>) {
    return this.events.getSessionForm(unwrap(message).sessionId);
  }

  @MessagePattern(EVENTS_PATTERNS.SESSION_FORM_UPSERT)
  upsertSessionForm(
    @Payload()
    message: Message<
      WithActor<UpsertRegistrationFormDto & { sessionId: string }>
    >,
  ) {
    const payload = unwrap(message);
    const { actorId, actorRole, sessionId, ...dto } = payload;
    return this.events.upsertSessionForm(sessionId, dto, actorOf(payload));
  }

  @MessagePattern(EVENTS_PATTERNS.FORM_UPSERT)
  upsertForm(
    @Payload()
    message: Message<WithActor<UpsertRegistrationFormDto & { eventId: string }>>,
  ) {
    const payload = unwrap(message);
    const { actorId, actorRole, eventId, ...dto } = payload;
    return this.events.upsertForm(eventId, dto, actorOf(payload));
  }
}
