import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { rpc } from '@somnog/common';
import { EVENTS_CLIENT } from '@somnog/config';
import {
  CreateRegistrationDto,
  EVENTS_PATTERNS,
  JwtClaims,
  ListRegistrationsQueryDto,
  RejectRegistrationDto,
  UserRole,
} from '@somnog/contracts';
import { ApiBody } from '@nestjs/swagger';
import { CorrelationId, CurrentUser, Roles } from '../auth/decorators';

@ApiTags('registrations')
@ApiBearerAuth()
@Controller()
export class RegistrationsController {
  constructor(@Inject(EVENTS_CLIENT) private readonly client: ClientProxy) {}

  private actor(user: JwtClaims) {
    return { actorId: user.sub, actorRole: user.role };
  }

  /**
   * The request that ties the whole system together. It returns as soon as the
   * seat is booked - the ticket email is on its way independently.
   */
  @Post('events/:id/registrations')
  @ApiOperation({ summary: 'Register for an event or one of its workshops' })
  @ApiBody({ type: CreateRegistrationDto })
  register(
    @Param('id') eventId: string,
    @Body() dto: CreateRegistrationDto,
    @CurrentUser() user: JwtClaims,
    @CorrelationId() cid: string,
  ) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.REGISTRATION_CREATE,
      { ...dto, eventId, ...this.actor(user) },
      { correlationId: cid },
    );
  }

  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @Get('events/:id/registrations')
  @ApiOperation({ summary: 'The attendee roster for an event' })
  listByEvent(
    @Param('id') eventId: string,
    @Query() query: ListRegistrationsQueryDto,
    @CurrentUser() user: JwtClaims,
    @CorrelationId() cid: string,
  ) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.REGISTRATION_LIST_BY_EVENT,
      { ...query, eventId, ...this.actor(user) },
      { correlationId: cid },
    );
  }

  @Get('me/registrations')
  @ApiOperation({ summary: 'My tickets' })
  mine(@CurrentUser() user: JwtClaims, @CorrelationId() cid: string) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.REGISTRATION_LIST_BY_USER,
      { userId: user.sub },
      { correlationId: cid },
    );
  }

  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @Patch('registrations/:id/approve')
  @ApiOperation({ summary: 'Approve a pending registration' })
  approve(
    @Param('id') registrationId: string,
    @CurrentUser() user: JwtClaims,
    @CorrelationId() cid: string,
  ) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.REGISTRATION_APPROVE,
      { registrationId, ...this.actor(user) },
      { correlationId: cid },
    );
  }

  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @Patch('registrations/:id/reject')
  @ApiOperation({ summary: 'Reject a pending registration' })
  reject(
    @Param('id') registrationId: string,
    @Body() dto: RejectRegistrationDto,
    @CurrentUser() user: JwtClaims,
    @CorrelationId() cid: string,
  ) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.REGISTRATION_REJECT,
      { registrationId, reason: dto.reason, ...this.actor(user) },
      { correlationId: cid },
    );
  }

  /** The attendee may cancel their own; an organiser may cancel anyone's. */
  @Patch('registrations/:id/cancel')
  @ApiOperation({ summary: 'Cancel a registration and promote the waitlist' })
  cancel(
    @Param('id') registrationId: string,
    @CurrentUser() user: JwtClaims,
    @CorrelationId() cid: string,
  ) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.REGISTRATION_CANCEL,
      { registrationId, ...this.actor(user) },
      { correlationId: cid },
    );
  }

  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @Post('registrations/:code/check-in')
  @HttpCode(200)
  @ApiOperation({ summary: 'Check in a ticket at the door' })
  checkIn(
    @Param('code') ticketCode: string,
    @CurrentUser() user: JwtClaims,
    @CorrelationId() cid: string,
  ) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.REGISTRATION_CHECK_IN,
      { ticketCode, ...this.actor(user) },
      { correlationId: cid },
    );
  }

  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @Get('events/:id/registrations/counts')
  @ApiOperation({ summary: 'Seat counts for an event' })
  counts(@Param('id') eventId: string, @CorrelationId() cid: string) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.REGISTRATION_COUNT_BY_EVENT,
      { eventId },
      { correlationId: cid },
    );
  }
}
