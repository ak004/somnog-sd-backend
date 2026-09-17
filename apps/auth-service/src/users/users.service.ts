import { Injectable } from '@nestjs/common';
import {
  ERROR_CODES,
  Paginated,
  paginate,
  PublicUser,
  ServiceError,
  skipTake,
  UpdateProfileDto,
  UserRole,
  UserSummary,
} from '@somnog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { toPublicUser, toUserSummary } from './user.mapper';

const SUMMARY_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  affiliation: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new ServiceError(ERROR_CODES.NOT_FOUND, 'User not found');
    }
    return toPublicUser(user);
  }

  /**
   * Batch lookup. The events service renders 300 registrations with one call
   * instead of 300 - the single most useful pattern to show students about
   * chatty services.
   */
  async findManyByIds(userIds: string[]): Promise<UserSummary[]> {
    if (userIds.length === 0) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(userIds)] } },
      select: SUMMARY_SELECT,
    });
    return users.map(toUserSummary);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.affiliation !== undefined && { affiliation: dto.affiliation }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
      },
    });
    return toPublicUser(user);
  }

  async list(query: {
    page?: number;
    limit?: number;
    q?: string;
    role?: UserRole;
  }): Promise<Paginated<PublicUser>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where = {
      ...(query.role && { role: query.role }),
      ...(query.q && {
        OR: [
          { email: { contains: query.q, mode: 'insensitive' as const } },
          { firstName: { contains: query.q, mode: 'insensitive' as const } },
          { lastName: { contains: query.q, mode: 'insensitive' as const } },
          { affiliation: { contains: query.q, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...skipTake(page, limit),
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(rows.map(toPublicUser), total, page, limit);
  }

  async setRole(userId: string, role: UserRole): Promise<PublicUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
    return toPublicUser(user);
  }
}
