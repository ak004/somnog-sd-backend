import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../common/pagination.dto';
import {
  EventStatus,
  EventType,
  EventVisibility,
  FormFieldType,
} from '../common/enums';

// --- categories -----------------------------------------------------------

export class CreateCategoryDto {
  @ApiProperty({ example: 'Trainings, Workshops & Seminars' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Parent category id, null for a root' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number;
}

export class UpdateCategoryDto extends CreateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  declare name: string;
}

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  isPublic: boolean;
  order: number;
  eventCount?: number;
  children?: CategoryNode[];
}

// --- events ---------------------------------------------------------------

export class CreateEventDto {
  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: 'SomNOG9 Conference' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(220)
  title!: string;

  @ApiProperty({ enum: EventType })
  @IsEnum(EventType)
  type!: EventType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @ApiPropertyOptional({ example: 'Mogadishu, Somalia' })
  @IsOptional()
  @IsString()
  @MaxLength(220)
  venue?: string;

  @ApiPropertyOptional({ default: 'Africa/Mogadishu' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiProperty({ example: '2026-11-02T08:00:00.000Z' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ example: '2026-11-04T17:00:00.000Z' })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ description: 'null or 0 means unlimited' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional({ enum: EventVisibility, default: EventVisibility.PUBLIC })
  @IsOptional()
  @IsEnum(EventVisibility)
  visibility?: EventVisibility;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bannerUrl?: string;
}

export class UpdateEventDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(220)
  title?: string;

  @ApiPropertyOptional({ enum: EventType })
  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  venue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional({ enum: EventVisibility })
  @IsOptional()
  @IsEnum(EventVisibility)
  visibility?: EventVisibility;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bannerUrl?: string;
}

export class ListEventsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: EventType })
  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({ description: 'ISO date, events ending after this' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date, events starting before this' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class CancelEventDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

// --- sessions (workshop tracks) ------------------------------------------

export class CreateSessionDto {
  @ApiProperty({ example: 'Software Development Track' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(220)
  title!: string;

  @ApiPropertyOptional({ example: 'software-development' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  track?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  abstract?: string;

  @ApiPropertyOptional({ example: 'Lab 2' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  room?: string;

  @ApiProperty()
  @IsDateString()
  startsAt!: string;

  @ApiProperty()
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ description: 'null or 0 means unlimited' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional({ description: 'User id of the speaker' })
  @IsOptional()
  @IsUUID()
  speakerUserId?: string;
}

export class UpdateSessionDto extends CreateSessionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  declare title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  declare startsAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  declare endsAt: string;
}

// --- registration form ----------------------------------------------------

export class FormFieldDto {
  @ApiProperty({ example: 'dietary' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  key!: string;

  @ApiProperty({ example: 'Dietary requirements' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(220)
  label!: string;

  @ApiProperty({ enum: FormFieldType })
  @IsEnum(FormFieldType)
  type!: FormFieldType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number;
}

export class UpsertRegistrationFormDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  opensAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  closesAt?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxPerUser?: number;

  @ApiPropertyOptional({ type: [FormFieldDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields?: FormFieldDto[];
}
