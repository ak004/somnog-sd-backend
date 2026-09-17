import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { publish } from '@somnog/common';
import { EVENT_BUS } from '@somnog/config';
import {
  AuthTokens,
  ChangePasswordDto,
  DOMAIN_EVENTS,
  ERROR_CODES,
  LoginDto,
  LoginResult,
  PublicUser,
  RegisterDto,
  ResetPasswordDto,
  ServiceError,
  UserRole,
  VerificationTokenType,
} from '@somnog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { TokensService } from '../tokens/tokens.service';
import { toPublicUser } from '../users/user.mapper';

const EMAIL_VERIFY_TTL_MINUTES = 60 * 24; // 24 hours
const PASSWORD_RESET_TTL_MINUTES = 60; // 1 hour

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    @Inject(EVENT_BUS) private readonly bus: ClientProxy,
  ) {}

  async register(
    dto: RegisterDto,
    correlationId?: string,
  ): Promise<PublicUser> {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ServiceError(
        ERROR_CODES.EMAIL_TAKEN,
        'An account with that email already exists',
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await argonHash(dto.password),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        affiliation: dto.affiliation?.trim() ?? null,
        country: dto.country?.trim() ?? null,
        phone: dto.phone?.trim() ?? null,
        role: UserRole.ATTENDEE,
      },
    });

    const verificationToken = await this.tokens.createVerificationToken(
      user.id,
      VerificationTokenType.EMAIL_VERIFY,
      EMAIL_VERIFY_TTL_MINUTES,
    );

    // Fire and forget. If the notification service is down the message waits
    // in its queue - the account is already created either way.
    publish(
      this.bus,
      DOMAIN_EVENTS.USER_REGISTERED,
      {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        verificationToken,
      },
      { correlationId },
    );

    return toPublicUser(user);
  }

  async login(
    dto: LoginDto,
    context: { userAgent?: string; ip?: string } = {},
  ): Promise<LoginResult> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Same error and roughly the same work whether or not the user exists,
    // so the response does not leak which emails are registered.
    if (!user) {
      await argonHash(dto.password).catch(() => undefined);
      throw new ServiceError(
        ERROR_CODES.INVALID_CREDENTIALS,
        'Email or password is incorrect',
      );
    }

    const valid = await argonVerify(user.passwordHash, dto.password);
    if (!valid) {
      throw new ServiceError(
        ERROR_CODES.INVALID_CREDENTIALS,
        'Email or password is incorrect',
      );
    }

    if (!user.isActive) {
      throw new ServiceError(
        ERROR_CODES.ACCOUNT_DISABLED,
        'This account has been disabled',
      );
    }

    const tokens = await this.tokens.issueTokens(
      { id: user.id, email: user.email, role: user.role as UserRole },
      context,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return { ...tokens, user: toPublicUser(user) };
  }

  refresh(
    refreshToken: string,
    context: { userAgent?: string; ip?: string } = {},
  ): Promise<AuthTokens> {
    return this.tokens.rotateRefreshToken(refreshToken, context);
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    await this.tokens.revokeRefreshToken(refreshToken);
    return { success: true };
  }

  async verifyEmail(
    token: string,
    correlationId?: string,
  ): Promise<{ success: true }> {
    const userId = await this.tokens.consumeVerificationToken(
      token,
      VerificationTokenType.EMAIL_VERIFY,
    );

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });

    publish(
      this.bus,
      DOMAIN_EVENTS.USER_EMAIL_VERIFIED,
      { userId: user.id, email: user.email, firstName: user.firstName },
      { correlationId },
    );

    return { success: true };
  }

  /**
   * Always reports success. Telling an anonymous caller whether an email is
   * registered is an account-enumeration hole.
   */
  async forgotPassword(
    email: string,
    correlationId?: string,
  ): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (user && user.isActive) {
      const resetToken = await this.tokens.createVerificationToken(
        user.id,
        VerificationTokenType.PASSWORD_RESET,
        PASSWORD_RESET_TTL_MINUTES,
      );

      publish(
        this.bus,
        DOMAIN_EVENTS.USER_PASSWORD_RESET_REQUESTED,
        {
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          resetToken,
        },
        { correlationId },
      );
    } else {
      this.logger.warn(`Password reset requested for unknown email: ${email}`);
    }

    return { success: true };
  }

  async resetPassword(
    dto: ResetPasswordDto,
    correlationId?: string,
  ): Promise<{ success: true }> {
    const userId = await this.tokens.consumeVerificationToken(
      dto.token,
      VerificationTokenType.PASSWORD_RESET,
    );

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argonHash(dto.password) },
    });

    // A password change signs out every existing session.
    await this.tokens.revokeAllForUser(userId);

    publish(
      this.bus,
      DOMAIN_EVENTS.USER_PASSWORD_CHANGED,
      { userId: user.id, email: user.email, firstName: user.firstName },
      { correlationId },
    );

    return { success: true };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    correlationId?: string,
  ): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new ServiceError(ERROR_CODES.NOT_FOUND, 'User not found');
    }

    const valid = await argonVerify(user.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new ServiceError(
        ERROR_CODES.INVALID_CREDENTIALS,
        'Current password is incorrect',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argonHash(dto.newPassword) },
    });

    await this.tokens.revokeAllForUser(userId);

    publish(
      this.bus,
      DOMAIN_EVENTS.USER_PASSWORD_CHANGED,
      { userId: user.id, email: user.email, firstName: user.firstName },
      { correlationId },
    );

    return { success: true };
  }
}
