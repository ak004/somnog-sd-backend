import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../common/pagination.dto';
import { RegistrationStatus } from '../common/enums';

export class CreateRegistrationDto {
  @ApiPropertyOptional({
    description:
      'Register for one workshop track inside the event. Omit to register for the event itself.',
  })
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'Answers to the event registration form, keyed by field key',
    example: { dietary: 'Vegetarian', tshirt: 'L' },
  })
  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;
}

export class ListRegistrationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RegistrationStatus })
  @IsOptional()
  @IsEnum(RegistrationStatus)
  status?: RegistrationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sessionId?: string;
}

export class RejectRegistrationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export interface RegistrationView {
  id: string;
  eventId: string;
  eventTitle?: string;
  sessionId: string | null;
  sessionTitle?: string | null;
  userId: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    affiliation: string | null;
  };
  status: RegistrationStatus;
  ticketCode: string;
  answers: Record<string, unknown>;
  registeredAt: string;
  checkedInAt: string | null;
  waitlistPosition?: number | null;
}

export interface RegistrationCounts {
  eventId: string;
  confirmed: number;
  pending: number;
  waitlisted: number;
  cancelled: number;
  checkedIn: number;
  capacity: number | null;
  seatsLeft: number | null;
}
