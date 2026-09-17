import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { JwtClaims, UserRole } from '@somnog/contracts';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** Marks a route as open - browsing events needs no account. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route to the given roles, read from the verified token. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Injects the verified claims: `@CurrentUser() user: JwtClaims`. */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtClaims | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtClaims | undefined;
    return data && user ? user[data] : user;
  },
);

/** Injects the request's correlation id, to pass into every RPC call. */
export const CorrelationId = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest().correlationId as string,
);
