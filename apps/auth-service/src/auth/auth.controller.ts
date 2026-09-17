import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AUTH_PATTERNS,
  ChangePasswordDto,
  LoginDto,
  Message,
  RegisterDto,
  ResetPasswordDto,
  unwrap,
} from '@somnog/contracts';
import { AuthService } from './auth.service';
import { TokensService } from '../tokens/tokens.service';

/**
 * This is a microservice controller, not an HTTP one. Nothing here knows about
 * routes, status codes or headers - the gateway owns all of that.
 *
 * Each handler answers one RPC pattern. The caller is waiting for the return
 * value, which Nest sends back over the reply queue.
 */
@Controller()
export class AuthMessageController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokensService,
  ) {}

  @MessagePattern(AUTH_PATTERNS.REGISTER)
  register(@Payload() message: Message<RegisterDto>) {
    return this.auth.register(unwrap(message), message.correlationId);
  }

  @MessagePattern(AUTH_PATTERNS.LOGIN)
  login(
    @Payload()
    message: Message<LoginDto & { userAgent?: string; ip?: string }>,
  ) {
    const { userAgent, ip, ...dto } = unwrap(message);
    return this.auth.login(dto, { userAgent, ip });
  }

  @MessagePattern(AUTH_PATTERNS.REFRESH)
  refresh(
    @Payload()
    message: Message<{ refreshToken: string; userAgent?: string; ip?: string }>,
  ) {
    const { refreshToken, userAgent, ip } = unwrap(message);
    return this.auth.refresh(refreshToken, { userAgent, ip });
  }

  @MessagePattern(AUTH_PATTERNS.LOGOUT)
  logout(@Payload() message: Message<{ refreshToken: string }>) {
    return this.auth.logout(unwrap(message).refreshToken);
  }

  @MessagePattern(AUTH_PATTERNS.VERIFY_EMAIL)
  verifyEmail(@Payload() message: Message<{ token: string }>) {
    return this.auth.verifyEmail(unwrap(message).token, message.correlationId);
  }

  @MessagePattern(AUTH_PATTERNS.FORGOT_PASSWORD)
  forgotPassword(@Payload() message: Message<{ email: string }>) {
    return this.auth.forgotPassword(
      unwrap(message).email,
      message.correlationId,
    );
  }

  @MessagePattern(AUTH_PATTERNS.RESET_PASSWORD)
  resetPassword(@Payload() message: Message<ResetPasswordDto>) {
    return this.auth.resetPassword(unwrap(message), message.correlationId);
  }

  @MessagePattern(AUTH_PATTERNS.CHANGE_PASSWORD)
  changePassword(
    @Payload() message: Message<ChangePasswordDto & { userId: string }>,
  ) {
    const { userId, ...dto } = unwrap(message);
    return this.auth.changePassword(userId, dto, message.correlationId);
  }

  /**
   * Fallback for a service that holds a raw token. The gateway does NOT use
   * this on every request - it verifies the signature locally, which is the
   * entire point of a stateless access token.
   */
  @MessagePattern(AUTH_PATTERNS.VERIFY_TOKEN)
  verifyToken(@Payload() message: Message<{ token: string }>) {
    return this.tokens.verifyAccessToken(unwrap(message).token);
  }
}
