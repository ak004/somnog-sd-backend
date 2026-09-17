import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import { generateOpaqueToken } from '@somnog/common';
import {
  AuthTokens,
  ERROR_CODES,
  JwtClaims,
  ServiceError,
  UserRole,
  VerificationTokenType,
} from '@somnog/contracts';
import { PrismaService } from '../prisma/prisma.service';

/**
 * All token minting and checking lives here.
 *
 * Refresh tokens and verification tokens are stored as SHA-256 hashes: a
 * leaked database row must not be a usable session or a usable reset link.
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * jsonwebtoken types `expiresIn` as a template-literal union ("15m", "7d"),
   * which a value read from the environment cannot satisfy at compile time.
   * The env schema validates it instead.
   */
  private ttl(value: string): JwtSignOptions['expiresIn'] {
    return value as JwtSignOptions['expiresIn'];
  }

  async issueTokens(
    user: { id: string; email: string; role: UserRole },
    context: { userAgent?: string; ip?: string } = {},
  ): Promise<AuthTokens> {
    const jti = randomUUID();
    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL', '15m');

    const claims: JwtClaims = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti,
    };

    const accessToken = await this.jwt.signAsync(claims, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.ttl(accessTtl),
    });

    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.ttl(this.config.get<string>('JWT_REFRESH_TTL', '7d')),
      },
    );

    const decoded = this.jwt.decode(refreshToken) as { exp: number };

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
        userAgent: context.userAgent ?? null,
        ip: context.ip ?? null,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.ttlToSeconds(accessTtl),
    };
  }

  /**
   * Rotation: the presented refresh token is revoked and a new pair issued.
   * Presenting an already-revoked token is treated as theft - every session
   * for that user is killed.
   */
  async rotateRefreshToken(
    refreshToken: string,
    context: { userAgent?: string; ip?: string } = {},
  ): Promise<AuthTokens> {
    let payload: { sub: string; jti: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new ServiceError(
        ERROR_CODES.TOKEN_INVALID,
        'Refresh token is invalid or expired',
      );
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(refreshToken) },
    });

    if (!stored) {
      throw new ServiceError(
        ERROR_CODES.TOKEN_INVALID,
        'Refresh token is not recognised',
      );
    }

    if (stored.revokedAt) {
      await this.revokeAllForUser(stored.userId);
      throw new ServiceError(
        ERROR_CODES.TOKEN_REVOKED,
        'Refresh token was already used. All sessions have been signed out.',
      );
    }

    if (stored.expiresAt < new Date()) {
      throw new ServiceError(ERROR_CODES.TOKEN_EXPIRED, 'Refresh token expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) {
      throw new ServiceError(
        ERROR_CODES.ACCOUNT_DISABLED,
        'Account is not active',
      );
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(
      { id: user.id, email: user.email, role: user.role as UserRole },
      context,
    );
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async verifyAccessToken(token: string): Promise<JwtClaims> {
    try {
      return await this.jwt.verifyAsync<JwtClaims>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new ServiceError(
        ERROR_CODES.TOKEN_INVALID,
        'Access token is invalid or expired',
      );
    }
  }

  /** Creates a one-time token and returns the PLAINTEXT to be emailed. */
  async createVerificationToken(
    userId: string,
    type: VerificationTokenType,
    ttlMinutes: number,
  ): Promise<string> {
    const token = generateOpaqueToken();
    await this.prisma.verificationToken.create({
      data: {
        userId,
        type,
        tokenHash: this.hash(token),
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      },
    });
    return token;
  }

  /** Consumes a one-time token, returning the user id it belonged to. */
  async consumeVerificationToken(
    token: string,
    type: VerificationTokenType,
  ): Promise<string> {
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: this.hash(token) },
    });

    if (!record || record.type !== type) {
      throw new ServiceError(ERROR_CODES.TOKEN_INVALID, 'Token is not valid');
    }
    if (record.usedAt) {
      throw new ServiceError(
        ERROR_CODES.TOKEN_REVOKED,
        'This link has already been used',
      );
    }
    if (record.expiresAt < new Date()) {
      throw new ServiceError(ERROR_CODES.TOKEN_EXPIRED, 'This link has expired');
    }

    await this.prisma.verificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return record.userId;
  }

  private ttlToSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 900;
    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return value * (multipliers[unit] ?? 60);
  }
}
