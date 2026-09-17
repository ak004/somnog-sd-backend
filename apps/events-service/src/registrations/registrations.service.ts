import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Prisma } from '../prisma/prisma-client';
import { generateTicketCode, publish } from '@somnog/common';
import { EVENT_BUS } from '@somnog/config';
import {
  CreateRegistrationDto,
  DOMAIN_EVENTS,
  ERROR_CODES,
  EventStatus,
  ListRegistrationsQueryDto,
  Paginated,
  paginate,
  RegistrationCounts,
  RegistrationStatus,
  ServiceError,
  skipTake,
  UserRole,
} from '@somnog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';

interface Actor {
  userId: string;
  role: UserRole;
}

/** Statuses that occupy a seat. */
const SEAT_TAKING: RegistrationStatus[] = [
  RegistrationStatus.PENDING,
  RegistrationStatus.CONFIRMED,
  RegistrationStatus.CHECKED_IN,
];

@Injectable()
export class RegistrationsService {
  private readonly logger = new Logger(RegistrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    @Inject(EVENT_BUS) private readonly bus: ClientProxy,
  ) {}

  /**
   * The heart of the service, and the best thing in this repo to walk students
   * through.
   *
   * Counting seats and inserting a row must be ONE atomic step. Read the count
   * outside a transaction and two people registering at the same moment both
   * see "1 seat left" and both get it. The transaction runs Serializable, so
   * Postgres aborts the loser and the retry sees the true count.
   */
  async create(
    idOrSlug: string,
    dto: CreateRegistrationDto,
    actor: Actor,
    correlationId?: string,
  ) {
    // Accepts a slug as well as a UUID, matching the rest of the event routes.
    const eventId = await this.events.resolveEventId(idOrSlug);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        form: { include: { fields: true } },
        sessions: { include: { form: { include: { fields: true } } } },
      },
    });

    if (!event) {
      throw new ServiceError(ERROR_CODES.EVENT_NOT_FOUND, 'Event not found');
    }
    if (event.status === EventStatus.CANCELLED) {
      throw new ServiceError(
        ERROR_CODES.EVENT_CANCELLED,
        'This event has been cancelled',
      );
    }
    if (event.status !== EventStatus.PUBLISHED) {
      throw new ServiceError(
        ERROR_CODES.EVENT_NOT_PUBLISHED,
        'This event is not open to registration yet',
      );
    }

    const session = dto.sessionId
      ? event.sessions.find((s) => s.id === dto.sessionId)
      : null;
    if (dto.sessionId && !session) {
      throw new ServiceError(
        ERROR_CODES.SESSION_NOT_FOUND,
        'That workshop is not part of this event',
      );
    }

    // Opening times and approval come from the EVENT form only.
    this.assertFormOpen(event.form);

    // Required questions come from the event form plus, when registering for
    // a track, that track's own extra questions. Both are answered into one
    // `answers` object; upsertSessionForm() rejects colliding keys so nothing
    // can be silently overwritten here.
    this.assertAnswers(
      [...(event.form?.fields ?? []), ...(session?.form?.fields ?? [])],
      dto.answers ?? {},
    );

    // Capacity of the thing actually being registered for.
    const capacity = session ? session.capacity : event.capacity;
    const requiresApproval = event.form?.requiresApproval ?? false;

    const result = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.registration.findFirst({
          where: {
            eventId,
            sessionId: dto.sessionId ?? null,
            userId: actor.userId,
            status: { notIn: [RegistrationStatus.CANCELLED] },
          },
        });
        if (existing) {
          throw new ServiceError(
            ERROR_CODES.ALREADY_REGISTERED,
            'You are already registered for this',
          );
        }

        const taken = await tx.registration.count({
          where: {
            eventId,
            sessionId: dto.sessionId ?? null,
            status: { in: SEAT_TAKING },
          },
        });

        const full = capacity !== null && capacity > 0 && taken >= capacity;

        if (full) {
          const position =
            (await tx.waitlist.count({
              where: { eventId, sessionId: dto.sessionId ?? null },
            })) + 1;

          await tx.waitlist.create({
            data: {
              eventId,
              sessionId: dto.sessionId ?? null,
              userId: actor.userId,
              position,
            },
          });

          const registration = await tx.registration.create({
            data: {
              eventId,
              sessionId: dto.sessionId ?? null,
              userId: actor.userId,
              status: RegistrationStatus.WAITLISTED,
              answers: (dto.answers ?? {}) as Prisma.InputJsonValue,
              ticketCode: generateTicketCode(),
            },
          });

          return { registration, position, full: true as const };
        }

        const registration = await tx.registration.create({
          data: {
            eventId,
            sessionId: dto.sessionId ?? null,
            userId: actor.userId,
            status: requiresApproval
              ? RegistrationStatus.PENDING
              : RegistrationStatus.CONFIRMED,
            answers: (dto.answers ?? {}) as Prisma.InputJsonValue,
            ticketCode: generateTicketCode(),
          },
        });

        return { registration, position: null, full: false as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // The row is committed. Only now do we announce it - and the caller is
    // NOT waiting for anyone to react.
    if (result.full) {
      publish(
        this.bus,
        DOMAIN_EVENTS.REGISTRATION_WAITLISTED,
        {
          registrationId: result.registration.id,
          userId: actor.userId,
          eventId,
          eventTitle: event.title,
          sessionId: dto.sessionId ?? null,
          position: result.position!,
        },
        { correlationId },
      );
    } else if (result.registration.status === RegistrationStatus.CONFIRMED) {
      this.announceConfirmed(
        result.registration,
        event,
        session ?? null,
        correlationId,
      );
    }

    return result.registration;
  }

  // --- organiser actions --------------------------------------------------

  async approve(registrationId: string, actor: Actor, correlationId?: string) {
    const registration = await this.getOr404(registrationId);
    await this.events.assertCanManage(registration.eventId, actor);

    const updated = await this.prisma.registration.update({
      where: { id: registrationId },
      data: { status: RegistrationStatus.CONFIRMED },
    });

    const event = await this.prisma.event.findUniqueOrThrow({
      where: { id: registration.eventId },
    });
    const session = registration.sessionId
      ? await this.prisma.session.findUnique({
          where: { id: registration.sessionId },
        })
      : null;

    this.announceConfirmed(updated, event, session, correlationId);
    return updated;
  }

  async reject(
    registrationId: string,
    reason: string | undefined,
    actor: Actor,
    correlationId?: string,
  ) {
    const registration = await this.getOr404(registrationId);
    await this.events.assertCanManage(registration.eventId, actor);

    const updated = await this.prisma.registration.update({
      where: { id: registrationId },
      data: {
        status: RegistrationStatus.REJECTED,
        rejectReason: reason ?? null,
      },
    });

    const event = await this.prisma.event.findUniqueOrThrow({
      where: { id: registration.eventId },
    });

    publish(
      this.bus,
      DOMAIN_EVENTS.REGISTRATION_REJECTED,
      {
        registrationId: updated.id,
        userId: updated.userId,
        eventId: event.id,
        eventTitle: event.title,
        reason: reason ?? null,
      },
      { correlationId },
    );

    return updated;
  }

  /**
   * Cancelling frees a seat, so the first person on the waitlist is promoted
   * in the same transaction. That promotion is itself a confirmed
   * registration, so it announces itself the same way.
   */
  async cancel(registrationId: string, actor: Actor, correlationId?: string) {
    const registration = await this.getOr404(registrationId);

    const isOwner = registration.userId === actor.userId;
    if (!isOwner) {
      await this.events.assertCanManage(registration.eventId, actor);
    }

    const { cancelled, promoted } = await this.prisma.$transaction(
      async (tx) => {
        const cancelled = await tx.registration.update({
          where: { id: registrationId },
          data: { status: RegistrationStatus.CANCELLED },
        });

        await tx.waitlist.deleteMany({
          where: {
            eventId: registration.eventId,
            sessionId: registration.sessionId,
            userId: registration.userId,
          },
        });

        const next = await tx.waitlist.findFirst({
          where: {
            eventId: registration.eventId,
            sessionId: registration.sessionId,
          },
          orderBy: { position: 'asc' },
        });

        let promoted = null;
        if (next) {
          promoted = await tx.registration.updateMany({
            where: {
              eventId: registration.eventId,
              sessionId: registration.sessionId,
              userId: next.userId,
              status: RegistrationStatus.WAITLISTED,
            },
            data: { status: RegistrationStatus.CONFIRMED },
          });
          await tx.waitlist.delete({ where: { id: next.id } });
        }

        return { cancelled, promoted: next };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const event = await this.prisma.event.findUniqueOrThrow({
      where: { id: registration.eventId },
    });

    publish(
      this.bus,
      DOMAIN_EVENTS.REGISTRATION_CANCELLED,
      {
        registrationId: cancelled.id,
        userId: cancelled.userId,
        eventId: event.id,
        eventTitle: event.title,
        cancelledBy: isOwner ? 'USER' : 'ORGANIZER',
      },
      { correlationId },
    );

    if (promoted) {
      const promotedRegistration = await this.prisma.registration.findFirst({
        where: {
          eventId: registration.eventId,
          sessionId: registration.sessionId,
          userId: promoted.userId,
          status: RegistrationStatus.CONFIRMED,
        },
      });
      if (promotedRegistration) {
        const session = registration.sessionId
          ? await this.prisma.session.findUnique({
              where: { id: registration.sessionId },
            })
          : null;
        this.logger.log(
          `Promoted ${promoted.userId} from the waitlist for ${event.title}`,
        );
        this.announceConfirmed(
          promotedRegistration,
          event,
          session,
          correlationId,
        );
      }
    }

    return cancelled;
  }

  async checkIn(ticketCode: string, actor: Actor, correlationId?: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { ticketCode: ticketCode.trim().toUpperCase() },
    });

    if (!registration) {
      throw new ServiceError(
        ERROR_CODES.INVALID_TICKET,
        'No registration matches that ticket code',
      );
    }
    await this.events.assertCanManage(registration.eventId, actor);

    if (registration.status === RegistrationStatus.CHECKED_IN) {
      throw new ServiceError(
        ERROR_CODES.ALREADY_CHECKED_IN,
        `Already checked in at ${registration.checkedInAt?.toISOString()}`,
      );
    }
    if (registration.status !== RegistrationStatus.CONFIRMED) {
      throw new ServiceError(
        ERROR_CODES.VALIDATION_FAILED,
        `Cannot check in a registration with status ${registration.status}`,
      );
    }

    const updated = await this.prisma.registration.update({
      where: { id: registration.id },
      data: {
        status: RegistrationStatus.CHECKED_IN,
        checkedInAt: new Date(),
      },
    });

    publish(
      this.bus,
      DOMAIN_EVENTS.REGISTRATION_CHECKED_IN,
      {
        registrationId: updated.id,
        userId: updated.userId,
        eventId: updated.eventId,
        checkedInAt: updated.checkedInAt!.toISOString(),
      },
      { correlationId },
    );

    return updated;
  }

  // --- reads --------------------------------------------------------------

  async listByEvent(
    idOrSlug: string,
    query: ListRegistrationsQueryDto,
    actor: Actor,
  ): Promise<Paginated<unknown>> {
    const eventId = await this.events.resolveEventId(idOrSlug);
    await this.events.assertCanManage(eventId, actor);

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where = {
      eventId,
      ...(query.status && { status: query.status }),
      ...(query.sessionId && { sessionId: query.sessionId }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.registration.findMany({
        where,
        orderBy: { registeredAt: 'asc' },
        include: { session: { select: { id: true, title: true } } },
        ...skipTake(page, limit),
      }),
      this.prisma.registration.count({ where }),
    ]);

    return paginate(rows, total, page, limit);
  }

  listByUser(userId: string) {
    return this.prisma.registration.findMany({
      where: { userId, status: { not: RegistrationStatus.CANCELLED } },
      orderBy: { registeredAt: 'desc' },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
            startsAt: true,
            endsAt: true,
            venue: true,
            status: true,
          },
        },
        session: { select: { id: true, title: true, room: true } },
      },
    });
  }

  /** Read-only counts other services (analytics, badges) can call. */
  async countsByEvent(idOrSlug: string): Promise<RegistrationCounts> {
    const eventId = await this.events.resolveEventId(idOrSlug);
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { capacity: true },
    });
    if (!event) {
      throw new ServiceError(ERROR_CODES.EVENT_NOT_FOUND, 'Event not found');
    }

    const grouped = await this.prisma.registration.groupBy({
      by: ['status'],
      where: { eventId },
      _count: { _all: true },
    });

    const count = (status: RegistrationStatus) =>
      grouped.find((g) => g.status === status)?._count._all ?? 0;

    const confirmed = count(RegistrationStatus.CONFIRMED);
    const checkedIn = count(RegistrationStatus.CHECKED_IN);
    const pending = count(RegistrationStatus.PENDING);
    const seatsTaken = confirmed + checkedIn + pending;

    return {
      eventId,
      confirmed,
      pending,
      waitlisted: count(RegistrationStatus.WAITLISTED),
      cancelled: count(RegistrationStatus.CANCELLED),
      checkedIn,
      capacity: event.capacity,
      seatsLeft: event.capacity ? Math.max(0, event.capacity - seatsTaken) : null,
    };
  }

  // --- helpers ------------------------------------------------------------

  private announceConfirmed(
    registration: { id: string; userId: string; ticketCode: string },
    event: {
      id: string;
      title: string;
      startsAt: Date;
      venue: string | null;
    },
    session: { id: string; title: string } | null,
    correlationId?: string,
  ) {
    publish(
      this.bus,
      DOMAIN_EVENTS.REGISTRATION_CONFIRMED,
      {
        registrationId: registration.id,
        userId: registration.userId,
        eventId: event.id,
        eventTitle: event.title,
        eventStartsAt: event.startsAt.toISOString(),
        sessionId: session?.id ?? null,
        sessionTitle: session?.title ?? null,
        ticketCode: registration.ticketCode,
        venue: event.venue,
      },
      { correlationId },
    );
  }

  private async getOr404(registrationId: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
    });
    if (!registration) {
      throw new ServiceError(
        ERROR_CODES.REGISTRATION_NOT_FOUND,
        'Registration not found',
      );
    }
    return registration;
  }

  private assertFormOpen(
    form: { isOpen: boolean; opensAt: Date | null; closesAt: Date | null } | null,
  ): void {
    if (!form) return; // no form configured means registration is simply open
    const now = new Date();

    if (!form.isOpen) {
      throw new ServiceError(
        ERROR_CODES.REGISTRATION_CLOSED,
        'Registration is closed for this event',
      );
    }
    if (form.opensAt && now < form.opensAt) {
      throw new ServiceError(
        ERROR_CODES.REGISTRATION_NOT_OPEN_YET,
        `Registration opens on ${form.opensAt.toISOString()}`,
      );
    }
    if (form.closesAt && now > form.closesAt) {
      throw new ServiceError(
        ERROR_CODES.REGISTRATION_CLOSED,
        `Registration closed on ${form.closesAt.toISOString()}`,
      );
    }
  }

  private assertAnswers(
    fields: Array<{ key: string; label: string; required: boolean }>,
    answers: Record<string, unknown>,
  ): void {
    if (fields.length === 0) return;

    const missing = fields
      .filter((field) => field.required)
      .filter((field) => {
        const value = answers[field.key];
        return value === undefined || value === null || value === '';
      })
      .map((field) => field.label);

    if (missing.length > 0) {
      throw new ServiceError(
        ERROR_CODES.REQUIRED_FIELD_MISSING,
        `Please answer: ${missing.join(', ')}`,
        { fields: missing },
      );
    }
  }
}
