import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtClaims, UserRole } from '@somnog/contracts';
import { ROLES_KEY } from './decorators';

/**
 * Coarse, platform-wide role check only.
 *
 * "Can this person edit THIS conference" is a different question with a
 * different answer, and it is asked inside the events service where the
 * EventRole rows live. Do not try to answer it here.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as
      | JwtClaims
      | undefined;

    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException(
        `This action requires one of: ${required.join(', ')}`,
      );
    }
    return true;
  }
}
