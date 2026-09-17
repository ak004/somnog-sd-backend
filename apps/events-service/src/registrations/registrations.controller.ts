import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreateRegistrationDto,
  EVENTS_PATTERNS,
  ListRegistrationsQueryDto,
  Message,
  UserRole,
  unwrap,
} from '@somnog/contracts';
import { RegistrationsService } from './registrations.service';

type WithActor<T> = T & { actorId: string; actorRole: UserRole };

const actorOf = <T>(payload: WithActor<T>) => ({
  userId: payload.actorId,
  role: payload.actorRole,
});

@Controller()
export class RegistrationsMessageController {
  constructor(private readonly registrations: RegistrationsService) {}

  @MessagePattern(EVENTS_PATTERNS.REGISTRATION_CREATE)
  create(
    @Payload()
    message: Message<WithActor<CreateRegistrationDto & { eventId: string }>>,
  ) {
    const payload = unwrap(message);
    const { actorId, actorRole, eventId, ...dto } = payload;
    return this.registrations.create(
      eventId,
      dto,
      actorOf(payload),
      message.correlationId,
    );
  }

  @MessagePattern(EVENTS_PATTERNS.REGISTRATION_LIST_BY_EVENT)
  listByEvent(
    @Payload()
    message: Message<WithActor<ListRegistrationsQueryDto & { eventId: string }>>,
  ) {
    const payload = unwrap(message);
    const { actorId, actorRole, eventId, ...query } = payload;
    return this.registrations.listByEvent(eventId, query, actorOf(payload));
  }

  @MessagePattern(EVENTS_PATTERNS.REGISTRATION_LIST_BY_USER)
  listByUser(@Payload() message: Message<{ userId: string }>) {
    return this.registrations.listByUser(unwrap(message).userId);
  }

  @MessagePattern(EVENTS_PATTERNS.REGISTRATION_APPROVE)
  approve(@Payload() message: Message<WithActor<{ registrationId: string }>>) {
    const payload = unwrap(message);
    return this.registrations.approve(
      payload.registrationId,
      actorOf(payload),
      message.correlationId,
    );
  }

  @MessagePattern(EVENTS_PATTERNS.REGISTRATION_REJECT)
  reject(
    @Payload()
    message: Message<WithActor<{ registrationId: string; reason?: string }>>,
  ) {
    const payload = unwrap(message);
    return this.registrations.reject(
      payload.registrationId,
      payload.reason,
      actorOf(payload),
      message.correlationId,
    );
  }

  @MessagePattern(EVENTS_PATTERNS.REGISTRATION_CANCEL)
  cancel(@Payload() message: Message<WithActor<{ registrationId: string }>>) {
    const payload = unwrap(message);
    return this.registrations.cancel(
      payload.registrationId,
      actorOf(payload),
      message.correlationId,
    );
  }

  @MessagePattern(EVENTS_PATTERNS.REGISTRATION_CHECK_IN)
  checkIn(@Payload() message: Message<WithActor<{ ticketCode: string }>>) {
    const payload = unwrap(message);
    return this.registrations.checkIn(
      payload.ticketCode,
      actorOf(payload),
      message.correlationId,
    );
  }

  @MessagePattern(EVENTS_PATTERNS.REGISTRATION_COUNT_BY_EVENT)
  counts(@Payload() message: Message<{ eventId: string }>) {
    return this.registrations.countsByEvent(unwrap(message).eventId);
  }
}
