import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { rpc } from '@somnog/common';
import { EVENTS_CLIENT } from '@somnog/config';
import {
  CancelEventDto,
  CreateCategoryDto,
  CreateEventDto,
  CreateSessionDto,
  EVENTS_PATTERNS,
  JwtClaims,
  ListEventsQueryDto,
  UpdateCategoryDto,
  UpdateEventDto,
  UpdateSessionDto,
  UpsertRegistrationFormDto,
  UserRole,
} from '@somnog/contracts';
import { CorrelationId, CurrentUser, Public, Roles } from '../auth/decorators';

@ApiTags('events')
@Controller()
export class EventsController {
  constructor(@Inject(EVENTS_CLIENT) private readonly client: ClientProxy) {}

  /** Everything the events service needs to know about who is asking. */
  private actor(user: JwtClaims) {
    return { actorId: user.sub, actorRole: user.role };
  }

  // --- categories (public browsing) ---------------------------------------

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'The public category tree' })
  categoryTree(@CorrelationId() correlationId: string) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.CATEGORY_TREE,
      { includePrivate: false },
      { correlationId },
    );
  }

  @Public()
  @Get('categories/:slug')
  @ApiOperation({ summary: 'One category and its children' })
  category(@Param('slug') slug: string, @CorrelationId() cid: string) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.CATEGORY_FIND,
      { slug },
      { correlationId: cid },
    );
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('categories')
  @ApiOperation({ summary: 'Create a category (admin)' })
  createCategory(@Body() dto: CreateCategoryDto, @CorrelationId() cid: string) {
    return rpc(this.client, EVENTS_PATTERNS.CATEGORY_CREATE, dto, {
      correlationId: cid,
    });
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update a category (admin)' })
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CorrelationId() cid: string,
  ) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.CATEGORY_UPDATE,
      { ...dto, id },
      { correlationId: cid },
    );
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Get('admin/categories')
  @ApiOperation({ summary: 'Every category, including private ones (admin)' })
  adminCategoryTree(@CorrelationId() cid: string) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.CATEGORY_TREE,
      { includePrivate: true },
      { correlationId: cid },
    );
  }

  // --- events -------------------------------------------------------------

  @Public()
  @Get('events')
  @ApiOperation({ summary: 'Browse published events' })
  list(@Query() query: ListEventsQueryDto, @CorrelationId() cid: string) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.EVENT_LIST,
      { ...query, publicOnly: true },
      { correlationId: cid },
    );
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @Get('manage/events')
  @ApiOperation({ summary: 'Browse events in any status (staff)' })
  manageList(@Query() query: ListEventsQueryDto, @CorrelationId() cid: string) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.EVENT_LIST,
      { ...query, publicOnly: false },
      { correlationId: cid },
    );
  }

  @Public()
  @Get('events/:slug')
  @ApiOperation({ summary: 'One event with its sessions and form' })
  find(@Param('slug') slug: string, @CorrelationId() cid: string) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.EVENT_FIND,
      { slug },
      { correlationId: cid },
    );
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @Post('events')
  @ApiOperation({ summary: 'Create an event' })
  create(
    @Body() dto: CreateEventDto,
    @CurrentUser() user: JwtClaims,
    @CorrelationId() cid: string,
  ) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.EVENT_CREATE,
      { ...dto, ...this.actor(user) },
      { correlationId: cid },
    );
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @Patch('events/:id')
  @ApiOperation({ summary: 'Update an event' })
  update(
    @Param('id') eventId: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: JwtClaims,
    @CorrelationId() cid: string,
  ) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.EVENT_UPDATE,
      { ...dto, eventId, ...this.actor(user) },
      { correlationId: cid },
    );
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @Post('events/:id/publish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Publish an event and announce it on the bus' })
  publish(
    @Param('id') eventId: string,
    @CurrentUser() user: JwtClaims,
    @CorrelationId() cid: string,
  ) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.EVENT_PUBLISH,
      { eventId, ...this.actor(user) },
      { correlationId: cid },
    );
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @Post('events/:id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel an event' })
  cancel(
    @Param('id') eventId: string,
    @Body() dto: CancelEventDto,
    @CurrentUser() user: JwtClaims,
    @CorrelationId() cid: string,
  ) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.EVENT_CANCEL,
      { ...dto, eventId, ...this.actor(user) },
      { correlationId: cid },
    );
  }

  // --- sessions (workshop tracks) ----------------------------------------

  @Public()
  @Get('events/:id/sessions')
  @ApiOperation({ summary: 'The workshop tracks inside an event' })
  sessions(@Param('id') eventId: string, @CorrelationId() cid: string) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.SESSION_LIST,
      { eventId },
      { correlationId: cid },
    );
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @Post('events/:id/sessions')
  @ApiOperation({ summary: 'Add a workshop track' })
  createSession(
    @Param('id') eventId: string,
    @Body() dto: CreateSessionDto,
    @CurrentUser() user: JwtClaims,
    @CorrelationId() cid: string,
  ) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.SESSION_CREATE,
      { ...dto, eventId, ...this.actor(user) },
      { correlationId: cid },
    );
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @Patch('sessions/:id')
  @ApiOperation({ summary: 'Update a workshop track' })
  updateSession(
    @Param('id') sessionId: string,
    @Body() dto: UpdateSessionDto,
    @CurrentUser() user: JwtClaims,
    @CorrelationId() cid: string,
  ) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.SESSION_UPDATE,
      { ...dto, sessionId, ...this.actor(user) },
      { correlationId: cid },
    );
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Delete an empty workshop track' })
  deleteSession(
    @Param('id') sessionId: string,
    @CurrentUser() user: JwtClaims,
    @CorrelationId() cid: string,
  ) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.SESSION_DELETE,
      { sessionId, ...this.actor(user) },
      { correlationId: cid },
    );
  }

  // --- registration form --------------------------------------------------

  @Public()
  @Get('events/:id/registration-form')
  @ApiOperation({ summary: 'The registration form for an event' })
  getForm(@Param('id') eventId: string, @CorrelationId() cid: string) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.FORM_GET,
      { eventId },
      { correlationId: cid },
    );
  }

  @Public()
  @Get('sessions/:id/registration-form')
  @ApiOperation({ summary: "A workshop track's own extra questions" })
  getSessionForm(@Param('id') sessionId: string, @CorrelationId() cid: string) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.SESSION_FORM_GET,
      { sessionId },
      { correlationId: cid },
    );
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @Put('sessions/:id/registration-form')
  @ApiOperation({ summary: "Set a workshop track's extra questions" })
  upsertSessionForm(
    @Param('id') sessionId: string,
    @Body() dto: UpsertRegistrationFormDto,
    @CurrentUser() user: JwtClaims,
    @CorrelationId() cid: string,
  ) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.SESSION_FORM_UPSERT,
      { ...dto, sessionId, ...this.actor(user) },
      { correlationId: cid },
    );
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @Put('events/:id/registration-form')
  @ApiOperation({ summary: 'Create or replace the registration form' })
  upsertForm(
    @Param('id') eventId: string,
    @Body() dto: UpsertRegistrationFormDto,
    @CurrentUser() user: JwtClaims,
    @CorrelationId() cid: string,
  ) {
    return rpc(
      this.client,
      EVENTS_PATTERNS.FORM_UPSERT,
      { ...dto, eventId, ...this.actor(user) },
      { correlationId: cid },
    );
  }
}
