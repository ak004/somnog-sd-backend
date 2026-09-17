import {
  Body,
  Controller,
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
import { NOTIFICATION_CLIENT } from '@somnog/config';
import {
  JwtClaims,
  ListNotificationsQueryDto,
  NOTIFICATION_PATTERNS,
  NotificationChannel,
  UpdatePreferenceDto,
  UpsertTemplateDto,
  UserRole,
} from '@somnog/contracts';
import { CorrelationId, CurrentUser, Roles } from '../auth/decorators';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller()
export class NotificationsController {
  constructor(
    @Inject(NOTIFICATION_CLIENT) private readonly client: ClientProxy,
  ) {}

  @Get('me/notifications')
  @ApiOperation({ summary: 'My in-app inbox' })
  mine(
    @Query() query: ListNotificationsQueryDto,
    @CurrentUser() user: JwtClaims,
    @CorrelationId() cid: string,
  ) {
    return rpc(
      this.client,
      NOTIFICATION_PATTERNS.LIST_FOR_USER,
      { ...query, userId: user.sub },
      { correlationId: cid },
    );
  }

  @Patch('me/notifications/:id/read')
  @ApiOperation({ summary: 'Mark one as read' })
  markRead(
    @Param('id') notificationId: string,
    @CurrentUser() user: JwtClaims,
    @CorrelationId() cid: string,
  ) {
    return rpc(
      this.client,
      NOTIFICATION_PATTERNS.MARK_READ,
      { notificationId, userId: user.sub },
      { correlationId: cid },
    );
  }

  @Get('me/notification-preferences')
  @ApiOperation({ summary: 'My channel preferences' })
  preferences(@CurrentUser() user: JwtClaims, @CorrelationId() cid: string) {
    return rpc(
      this.client,
      NOTIFICATION_PATTERNS.PREFERENCES_GET,
      { userId: user.sub },
      { correlationId: cid },
    );
  }

  @Put('me/notification-preferences')
  @ApiOperation({ summary: 'Opt in or out of a channel' })
  updatePreference(
    @Body() dto: UpdatePreferenceDto,
    @CurrentUser() user: JwtClaims,
    @CorrelationId() cid: string,
  ) {
    return rpc(
      this.client,
      NOTIFICATION_PATTERNS.PREFERENCES_UPDATE,
      { ...dto, userId: user.sub },
      { correlationId: cid },
    );
  }

  // --- admin --------------------------------------------------------------

  @Roles(UserRole.ADMIN)
  @Get('admin/notifications')
  @ApiOperation({ summary: 'Delivery log (admin)' })
  listAll(
    @Query() query: ListNotificationsQueryDto,
    @CorrelationId() cid: string,
  ) {
    return rpc(this.client, NOTIFICATION_PATTERNS.LIST_ALL, query, {
      correlationId: cid,
    });
  }

  @Roles(UserRole.ADMIN)
  @Post('admin/notifications/:id/retry')
  @HttpCode(200)
  @ApiOperation({ summary: 'Re-queue a failed delivery (admin)' })
  retry(@Param('id') notificationId: string, @CorrelationId() cid: string) {
    return rpc(
      this.client,
      NOTIFICATION_PATTERNS.RETRY,
      { notificationId },
      { correlationId: cid },
    );
  }

  @Roles(UserRole.ADMIN)
  @Get('admin/templates')
  @ApiOperation({ summary: 'List templates (admin)' })
  templates(
    @Query('channel') channel: NotificationChannel | undefined,
    @CorrelationId() cid: string,
  ) {
    return rpc(
      this.client,
      NOTIFICATION_PATTERNS.TEMPLATE_LIST,
      { channel },
      { correlationId: cid },
    );
  }

  @Roles(UserRole.ADMIN)
  @Put('admin/templates')
  @ApiOperation({ summary: 'Create or update a template (admin)' })
  upsertTemplate(
    @Body() dto: UpsertTemplateDto,
    @CorrelationId() cid: string,
  ) {
    return rpc(this.client, NOTIFICATION_PATTERNS.TEMPLATE_UPSERT, dto, {
      correlationId: cid,
    });
  }
}
