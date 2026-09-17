import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AUTH_PATTERNS,
  Message,
  UpdateProfileDto,
  UserRole,
  unwrap,
} from '@somnog/contracts';
import { UsersService } from './users.service';

@Controller()
export class UsersMessageController {
  constructor(private readonly users: UsersService) {}

  @MessagePattern(AUTH_PATTERNS.FIND_BY_ID)
  findById(@Payload() message: Message<{ userId: string }>) {
    return this.users.findById(unwrap(message).userId);
  }

  @MessagePattern(AUTH_PATTERNS.FIND_MANY_BY_IDS)
  findManyByIds(@Payload() message: Message<{ userIds: string[] }>) {
    return this.users.findManyByIds(unwrap(message).userIds);
  }

  @MessagePattern(AUTH_PATTERNS.UPDATE_PROFILE)
  updateProfile(
    @Payload() message: Message<UpdateProfileDto & { userId: string }>,
  ) {
    const { userId, ...dto } = unwrap(message);
    return this.users.updateProfile(userId, dto);
  }

  @MessagePattern(AUTH_PATTERNS.LIST_USERS)
  list(
    @Payload()
    message: Message<{
      page?: number;
      limit?: number;
      q?: string;
      role?: UserRole;
    }>,
  ) {
    return this.users.list(unwrap(message));
  }

  @MessagePattern(AUTH_PATTERNS.SET_ROLE)
  setRole(@Payload() message: Message<{ userId: string; role: UserRole }>) {
    const { userId, role } = unwrap(message);
    return this.users.setRole(userId, role);
  }
}
