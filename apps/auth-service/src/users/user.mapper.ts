import { PublicUser, UserRole, UserSummary } from '@somnog/contracts';

type UserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  affiliation: string | null;
  country: string | null;
  phone: string | null;
  role: string;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: Date;
};

/**
 * The only shape that leaves this service. passwordHash never appears in a
 * response - map explicitly rather than spreading the row.
 */
export function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    affiliation: user.affiliation,
    country: user.country,
    phone: user.phone,
    role: user.role as UserRole,
    emailVerified: user.emailVerified,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Even smaller shape, for other services rendering a name. */
export function toUserSummary(
  user: Pick<
    UserRow,
    'id' | 'email' | 'firstName' | 'lastName' | 'affiliation'
  >,
): UserSummary {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    affiliation: user.affiliation,
  };
}
