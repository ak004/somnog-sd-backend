import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { publish, uniqueSlug } from '@somnog/common';
import { EVENT_BUS } from '@somnog/config';
import {
  CancelEventDto,
  CreateEventDto,
  CreateSessionDto,
  DOMAIN_EVENTS,
  ERROR_CODES,
  EventRoleType,
  EventStatus,
  EventVisibility,
  ListEventsQueryDto,
  Paginated,
  paginate,
  ServiceError,
  skipTake,
  UpdateEventDto,
  UpdateSessionDto,
  UpsertRegistrationFormDto,
  UserRole,
} from '@somnog/contracts';
import { PrismaService } from '../prisma/prisma.service';

interface Actor {
  userId: string;
  role: UserRole;
}

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_BUS) private readonly bus: ClientProxy,
  ) {}

  // --- reads --------------------------------------------------------------

  async list(query: ListEventsQueryDto): Promise<Paginated<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Record<string, unknown> = {
      // Anonymous browsing only ever sees published, public events.
      status: query.status ?? EventStatus.PUBLISHED,
      visibility: EventVisibility.PUBLIC,
      ...(query.type && { type: query.type }),
      ...(query.category && { category: { slug: query.category } }),
      ...(query.from && { endsAt: { gte: new Date(query.from) } }),
      ...(query.to && { startsAt: { lte: new Date(query.to) } }),
      ...(query.q && {
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
          { venue: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where: where as never,
        orderBy: { startsAt: 'asc' },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          _count: { select: { sessions: true, registrations: true } },
        },
        ...skipTake(page, limit),
      }),
      this.prisma.event.count({ where: where as never }),
    ]);

    return paginate(rows, total, page, limit);
  }

  async findBySlug(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        sessions: {
          orderBy: { startsAt: 'asc' },
          include: { form: { include: { fields: { orderBy: { order: 'asc' } } } } },
        },
        form: { include: { fields: { orderBy: { order: 'asc' } } } },
        _count: { select: { registrations: true } },
      },
    });

    if (!event) {
      throw new ServiceError(
        ERROR_CODES.EVENT_NOT_FOUND,
        `No event with slug "${slug}"`,
      );
    }
    return event;
  }

  /**
   * Accepts either a UUID or a slug.
   *
   * `/events/somnog9-conference` reads far better than a UUID, and people
   * naturally paste the same value into `/events/:id/registration-form`. The
   * API should not punish them for it.
   */
  async resolveEventId(idOrSlug: string): Promise<string> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrSlug,
      );
    if (isUuid) return idOrSlug;

    const event = await this.prisma.event.findUnique({
      where: { slug: idOrSlug },
      select: { id: true },
    });
    if (!event) {
      throw new ServiceError(
        ERROR_CODES.EVENT_NOT_FOUND,
        `No event with id or slug "${idOrSlug}"`,
      );
    }
    return event.id;
  }

  async findById(idOrSlug: string) {
    const eventId = await this.resolveEventId(idOrSlug);
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { category: true, sessions: true },
    });
    if (!event) {
      throw new ServiceError(ERROR_CODES.EVENT_NOT_FOUND, 'Event not found');
    }
    return event;
  }

  // --- writes -------------------------------------------------------------

  async create(dto: CreateEventDto, actor: Actor) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new ServiceError(
        ERROR_CODES.CATEGORY_NOT_FOUND,
        'Category not found',
      );
    }

    this.assertDateOrder(dto.startsAt, dto.endsAt);

    const slug = await uniqueSlug(dto.title, async (candidate) =>
      Boolean(
        await this.prisma.event.findUnique({ where: { slug: candidate } }),
      ),
    );

    // The creator becomes OWNER in the same transaction as the event, so an
    // event can never exist with nobody able to manage it.
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          categoryId: dto.categoryId,
          title: dto.title.trim(),
          slug,
          type: dto.type,
          description: dto.description ?? null,
          venue: dto.venue ?? null,
          timezone: dto.timezone ?? 'Africa/Mogadishu',
          startsAt: new Date(dto.startsAt),
          endsAt: new Date(dto.endsAt),
          capacity: dto.capacity ?? null,
          visibility: dto.visibility ?? EventVisibility.PUBLIC,
          bannerUrl: dto.bannerUrl ?? null,
          createdByUserId: actor.userId,
          status: EventStatus.DRAFT,
        },
      });

      await tx.eventRole.create({
        data: {
          eventId: event.id,
          userId: actor.userId,
          role: EventRoleType.OWNER,
        },
      });

      return event;
    });
  }

  async update(eventId: string, dto: UpdateEventDto, actor: Actor) {
    await this.assertCanManage(eventId, actor);

    if (dto.startsAt && dto.endsAt) {
      this.assertDateOrder(dto.startsAt, dto.endsAt);
    }

    return this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.title && { title: dto.title.trim() }),
        ...(dto.type && { type: dto.type }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.venue !== undefined && { venue: dto.venue }),
        ...(dto.timezone && { timezone: dto.timezone }),
        ...(dto.startsAt && { startsAt: new Date(dto.startsAt) }),
        ...(dto.endsAt && { endsAt: new Date(dto.endsAt) }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.visibility && { visibility: dto.visibility }),
        ...(dto.bannerUrl !== undefined && { bannerUrl: dto.bannerUrl }),
      },
    });
  }

  /**
   * Publishing is the moment an event becomes real to the outside world, so
   * it is also the moment an event is announced on the bus.
   */
  async publish(eventId: string, actor: Actor, correlationId?: string) {
    await this.assertCanManage(eventId, actor);

    const event = await this.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      include: { category: true },
    });

    if (event.status === EventStatus.PUBLISHED) {
      return event; // idempotent: publishing twice is not an error
    }
    if (event.status === EventStatus.CANCELLED) {
      throw new ServiceError(
        ERROR_CODES.EVENT_CANCELLED,
        'A cancelled event cannot be published',
      );
    }

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: { status: EventStatus.PUBLISHED, publishedAt: new Date() },
      include: { category: true },
    });

    publish(
      this.bus,
      DOMAIN_EVENTS.EVENT_PUBLISHED,
      {
        eventId: updated.id,
        title: updated.title,
        slug: updated.slug,
        type: updated.type,
        categoryId: updated.categoryId,
        categoryName: updated.category.name,
        startsAt: updated.startsAt.toISOString(),
        endsAt: updated.endsAt.toISOString(),
        venue: updated.venue,
      },
      { correlationId },
    );

    return updated;
  }

  async cancel(
    eventId: string,
    dto: CancelEventDto,
    actor: Actor,
    correlationId?: string,
  ) {
    await this.assertCanManage(eventId, actor);

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        status: EventStatus.CANCELLED,
        cancelReason: dto.reason ?? null,
      },
    });

    const affected = await this.prisma.registration.findMany({
      where: { eventId, status: { in: ['CONFIRMED', 'PENDING', 'WAITLISTED'] } },
      select: { userId: true },
      distinct: ['userId'],
    });

    publish(
      this.bus,
      DOMAIN_EVENTS.EVENT_CANCELLED,
      {
        eventId: updated.id,
        title: updated.title,
        reason: updated.cancelReason,
        affectedUserIds: affected.map((r) => r.userId),
      },
      { correlationId },
    );

    return updated;
  }

  // --- sessions (workshop tracks) ----------------------------------------

  async listSessions(idOrSlug: string) {
    const eventId = await this.resolveEventId(idOrSlug);
    return this.prisma.session.findMany({
      where: { eventId },
      orderBy: { startsAt: 'asc' },
      include: {
        _count: { select: { registrations: true } },
        form: { include: { fields: { orderBy: { order: 'asc' } } } },
      },
    });
  }

  async createSession(
    idOrSlug: string,
    dto: CreateSessionDto,
    actor: Actor,
  ) {
    const eventId = await this.resolveEventId(idOrSlug);
    await this.assertCanManage(eventId, actor);
    this.assertDateOrder(dto.startsAt, dto.endsAt);

    return this.prisma.session.create({
      data: {
        eventId,
        title: dto.title.trim(),
        track: dto.track ?? null,
        abstract: dto.abstract ?? null,
        room: dto.room ?? null,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        capacity: dto.capacity ?? null,
        speakerUserId: dto.speakerUserId ?? null,
      },
    });
  }

  async updateSession(
    sessionId: string,
    dto: UpdateSessionDto,
    actor: Actor,
  ) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new ServiceError(
        ERROR_CODES.SESSION_NOT_FOUND,
        'Session not found',
      );
    }
    await this.assertCanManage(session.eventId, actor);

    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        ...(dto.title && { title: dto.title.trim() }),
        ...(dto.track !== undefined && { track: dto.track }),
        ...(dto.abstract !== undefined && { abstract: dto.abstract }),
        ...(dto.room !== undefined && { room: dto.room }),
        ...(dto.startsAt && { startsAt: new Date(dto.startsAt) }),
        ...(dto.endsAt && { endsAt: new Date(dto.endsAt) }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.speakerUserId !== undefined && {
          speakerUserId: dto.speakerUserId,
        }),
      },
    });
  }

  async deleteSession(sessionId: string, actor: Actor) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { _count: { select: { registrations: true } } },
    });
    if (!session) {
      throw new ServiceError(
        ERROR_CODES.SESSION_NOT_FOUND,
        'Session not found',
      );
    }
    await this.assertCanManage(session.eventId, actor);

    if (session._count.registrations > 0) {
      throw new ServiceError(
        ERROR_CODES.CONFLICT,
        'This session already has registrations and cannot be deleted',
      );
    }

    await this.prisma.session.delete({ where: { id: sessionId } });
    return { success: true };
  }

  // --- registration form --------------------------------------------------

  async getForm(idOrSlug: string) {
    const eventId = await this.resolveEventId(idOrSlug);
    const form = await this.prisma.registrationForm.findUnique({
      where: { eventId },
      include: { fields: { orderBy: { order: 'asc' } } },
    });

    // Returning null here meant a 200 with an empty body, which reads as "the
    // server is broken" rather than "this event has no form".
    if (!form) {
      throw new ServiceError(
        ERROR_CODES.NOT_FOUND,
        'This event has no registration form',
      );
    }
    return form;
  }

  async upsertForm(
    idOrSlug: string,
    dto: UpsertRegistrationFormDto,
    actor: Actor,
  ) {
    const eventId = await this.resolveEventId(idOrSlug);
    await this.assertCanManage(eventId, actor);

    return this.prisma.$transaction(async (tx) => {
      const form = await tx.registrationForm.upsert({
        where: { eventId },
        create: {
          eventId,
          isOpen: dto.isOpen ?? true,
          opensAt: dto.opensAt ? new Date(dto.opensAt) : null,
          closesAt: dto.closesAt ? new Date(dto.closesAt) : null,
          requiresApproval: dto.requiresApproval ?? false,
          maxPerUser: dto.maxPerUser ?? 1,
        },
        update: {
          ...(dto.isOpen !== undefined && { isOpen: dto.isOpen }),
          ...(dto.opensAt !== undefined && {
            opensAt: dto.opensAt ? new Date(dto.opensAt) : null,
          }),
          ...(dto.closesAt !== undefined && {
            closesAt: dto.closesAt ? new Date(dto.closesAt) : null,
          }),
          ...(dto.requiresApproval !== undefined && {
            requiresApproval: dto.requiresApproval,
          }),
          ...(dto.maxPerUser !== undefined && { maxPerUser: dto.maxPerUser }),
        },
      });

      if (dto.fields) {
        // Replace the field set wholesale: the client always sends the full
        // list, which keeps ordering and deletions simple to reason about.
        await tx.formField.deleteMany({ where: { formId: form.id } });
        await tx.formField.createMany({
          data: dto.fields.map((field, index) => ({
            formId: form.id,
            key: field.key,
            label: field.label,
            type: field.type,
            required: field.required ?? false,
            options: field.options ?? [],
            order: field.order ?? index,
          })),
        });
      }

      return tx.registrationForm.findUnique({
        where: { id: form.id },
        include: { fields: { orderBy: { order: 'asc' } } },
      });
    });
  }

  // --- track forms --------------------------------------------------------

  /**
   * A workshop track may add its own questions on top of the event's form.
   * Registering for that track means answering both, merged into one object.
   */
  async getSessionForm(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { form: { include: { fields: { orderBy: { order: 'asc' } } } } },
    });
    if (!session) {
      throw new ServiceError(
        ERROR_CODES.SESSION_NOT_FOUND,
        'Session not found',
      );
    }
    if (!session.form) {
      throw new ServiceError(
        ERROR_CODES.NOT_FOUND,
        'This track has no extra questions of its own',
      );
    }
    return session.form;
  }

  async upsertSessionForm(
    sessionId: string,
    dto: UpsertRegistrationFormDto,
    actor: Actor,
  ) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, eventId: true },
    });
    if (!session) {
      throw new ServiceError(
        ERROR_CODES.SESSION_NOT_FOUND,
        'Session not found',
      );
    }
    await this.assertCanManage(session.eventId, actor);

    // A track question must not collide with an event question: both end up
    // in the same answers object, so the same key twice means one silently
    // overwrites the other.
    if (dto.fields?.length) {
      const eventForm = await this.prisma.registrationForm.findUnique({
        where: { eventId: session.eventId },
        include: { fields: { select: { key: true } } },
      });
      const eventKeys = new Set(eventForm?.fields.map((f) => f.key) ?? []);
      const clashes = dto.fields
        .map((f) => f.key)
        .filter((key) => eventKeys.has(key));
      if (clashes.length > 0) {
        throw new ServiceError(
          ERROR_CODES.CONFLICT,
          `These keys already exist on the event form: ${clashes.join(', ')}`,
          { keys: clashes },
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const form = await tx.registrationForm.upsert({
        where: { sessionId },
        create: { sessionId },
        update: {},
      });

      if (dto.fields) {
        await tx.formField.deleteMany({ where: { formId: form.id } });
        await tx.formField.createMany({
          data: dto.fields.map((field, index) => ({
            formId: form.id,
            key: field.key,
            label: field.label,
            type: field.type,
            required: field.required ?? false,
            options: field.options ?? [],
            order: field.order ?? index,
          })),
        });
      }

      return tx.registrationForm.findUnique({
        where: { id: form.id },
        include: { fields: { orderBy: { order: 'asc' } } },
      });
    });
  }

  // --- permissions --------------------------------------------------------

  /**
   * Per-event permission check. A platform ADMIN passes automatically;
   * everyone else needs an EventRole row for this event.
   */
  async assertCanManage(eventId: string, actor: Actor): Promise<void> {
    if (actor.role === UserRole.ADMIN) return;

    const role = await this.prisma.eventRole.findUnique({
      where: { eventId_userId: { eventId, userId: actor.userId } },
    });

    if (!role || role.role === EventRoleType.REVIEWER) {
      throw new ServiceError(
        ERROR_CODES.FORBIDDEN,
        'You do not have permission to manage this event',
      );
    }
  }

  private assertDateOrder(startsAt: string, endsAt: string): void {
    if (new Date(endsAt) <= new Date(startsAt)) {
      throw new ServiceError(
        ERROR_CODES.VALIDATION_FAILED,
        'endsAt must be after startsAt',
      );
    }
  }
}
