import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../common/pagination.dto';
import { NotificationChannel, NotificationStatus } from '../common/enums';

export class ListNotificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: NotificationStatus })
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @ApiPropertyOptional({ enum: NotificationChannel })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;
}

export class UpdatePreferenceDto {
  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @ApiProperty({ example: 'event_reminder' })
  @IsString()
  @IsNotEmpty()
  category!: string;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class UpsertTemplateDto {
  @ApiProperty({ example: 'registration_ticket' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  key!: string;

  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @ApiPropertyOptional({ default: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  locale?: string;

  @ApiProperty({ description: 'Handlebars, may use payload variables' })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiProperty({ description: 'Handlebars body' })
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SendDirectNotificationDto {
  @ApiProperty()
  @IsEmail()
  recipient!: string;

  @ApiProperty({ example: 'event_announcement' })
  @IsString()
  @IsNotEmpty()
  templateKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: NotificationChannel })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;
}

export interface NotificationView {
  id: string;
  userId: string | null;
  recipient: string;
  channel: NotificationChannel;
  templateKey: string;
  subject: string | null;
  status: NotificationStatus;
  attempts: number;
  lastError: string | null;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
}
