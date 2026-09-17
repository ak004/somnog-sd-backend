import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { rpc } from '@somnog/common';
import { AUTH_CLIENT } from '@somnog/config';
import {
  AUTH_PATTERNS,
  ChangePasswordDto,
  ForgotPasswordDto,
  JwtClaims,
  LoginDto,
  PaginationQueryDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  SetRoleDto,
  UpdateProfileDto,
  UserRole,
  VerifyEmailDto,
} from '@somnog/contracts';
import {
  CorrelationId,
  CurrentUser,
  Public,
  Roles,
} from '../auth/decorators';

/**
 * Notice how little happens here: validate, forward, return. Every controller
 * in the gateway should read like this. If one grows a branch of business
 * logic, that logic belongs in a service.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AUTH_CLIENT) private readonly client: ClientProxy) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Create an account' })
  register(@Body() dto: RegisterDto, @CorrelationId() correlationId: string) {
    return rpc(this.client, AUTH_PATTERNS.REGISTER, dto, { correlationId });
  }

  // Tighter than the global limit: login is where credential stuffing lands.
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: 'Exchange credentials for tokens' })
  login(
    @Body() dto: LoginDto,
    @Req() req: { headers: Record<string, string>; ip?: string },
    @CorrelationId() correlationId: string,
  ) {
    return rpc(
      this.client,
      AUTH_PATTERNS.LOGIN,
      { ...dto, userAgent: req.headers['user-agent'], ip: req.ip },
      { correlationId },
    );
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate a refresh token' })
  refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: { headers: Record<string, string>; ip?: string },
    @CorrelationId() correlationId: string,
  ) {
    return rpc(
      this.client,
      AUTH_PATTERNS.REFRESH,
      { ...dto, userAgent: req.headers['user-agent'], ip: req.ip },
      { correlationId },
    );
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Revoke a refresh token' })
  logout(@Body() dto: RefreshTokenDto, @CorrelationId() correlationId: string) {
    return rpc(this.client, AUTH_PATTERNS.LOGOUT, dto, { correlationId });
  }

  @Public()
  @Post('verify-email')
  @ApiOperation({ summary: 'Confirm an email address' })
  verifyEmail(
    @Body() dto: VerifyEmailDto,
    @CorrelationId() correlationId: string,
  ) {
    return rpc(this.client, AUTH_PATTERNS.VERIFY_EMAIL, dto, { correlationId });
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset link' })
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @CorrelationId() correlationId: string,
  ) {
    return rpc(this.client, AUTH_PATTERNS.FORGOT_PASSWORD, dto, {
      correlationId,
    });
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Set a new password with a reset token' })
  resetPassword(
    @Body() dto: ResetPasswordDto,
    @CorrelationId() correlationId: string,
  ) {
    return rpc(this.client, AUTH_PATTERNS.RESET_PASSWORD, dto, {
      correlationId,
    });
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'The signed-in profile' })
  me(
    @CurrentUser() user: JwtClaims,
    @CorrelationId() correlationId: string,
  ) {
    return rpc(
      this.client,
      AUTH_PATTERNS.FIND_BY_ID,
      { userId: user.sub },
      { correlationId, actor: { userId: user.sub, role: user.role } },
    );
  }

  @ApiBearerAuth()
  @Patch('me')
  @ApiOperation({ summary: 'Update the signed-in profile' })
  updateMe(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: JwtClaims,
    @CorrelationId() correlationId: string,
  ) {
    return rpc(
      this.client,
      AUTH_PATTERNS.UPDATE_PROFILE,
      { ...dto, userId: user.sub },
      { correlationId },
    );
  }

  @ApiBearerAuth()
  @Post('me/change-password')
  @ApiOperation({ summary: 'Change password and sign out every session' })
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: JwtClaims,
    @CorrelationId() correlationId: string,
  ) {
    return rpc(
      this.client,
      AUTH_PATTERNS.CHANGE_PASSWORD,
      { ...dto, userId: user.sub },
      { correlationId },
    );
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Get('users')
  @ApiOperation({ summary: 'List accounts (admin)' })
  listUsers(
    @Query() query: PaginationQueryDto,
    @CorrelationId() correlationId: string,
  ) {
    return rpc(this.client, AUTH_PATTERNS.LIST_USERS, query, {
      correlationId,
    });
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Change an account role (admin)' })
  setRole(
    @Body() dto: SetRoleDto,
    @Param('id') userId: string,
    @CorrelationId() correlationId: string,
  ) {
    return rpc(
      this.client,
      AUTH_PATTERNS.SET_ROLE,
      { userId, role: dto.role },
      { correlationId },
    );
  }
}
