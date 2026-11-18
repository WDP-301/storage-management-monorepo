import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiErrorResponseDto } from '@shared/models/api-response';
import type { Request, Response } from 'express';
import { AuthCookieService } from './auth.cookie';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  AuthMeResponseDto,
  AuthUserResponseDto,
  LoginResponseDto,
  LogoutResponseDto,
} from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SessionGuard } from './guards/session.guard';
import type {
  AuthMeResponse,
  AuthUser,
  AuthUserResponse,
  LoginResponse,
  LogoutResponse,
  SessionContext,
} from './types/auth-user';

/** Sign-ups per client IP, far below the global 100/min. */
const REGISTER_LIMIT = { limit: 10, ttl: 60_000 };

/**
 * Login attempts per client IP and email: slows password guessing on one account without locking
 * out everyone who shares an IP (an office, or the web app's proxy).
 */
const LOGIN_LIMIT = {
  limit: 10,
  ttl: 60_000,
  getTracker: (req: Record<string, any>) =>
    `${req.ip}:${String(req.body?.email ?? '')
      .trim()
      .toLowerCase()}`,
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookies: AuthCookieService,
  ) {}

  @Post('register')
  @Throttle({ default: REGISTER_LIMIT })
  @ApiOperation({ summary: 'Register a customer account' })
  @ApiResponse({ status: 201, description: 'Account created', type: AuthUserResponseDto })
  async register(@Body() dto: RegisterDto): Promise<AuthUserResponse> {
    const user = await this.authService.register(dto);
    return { user };
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: LOGIN_LIMIT })
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Authenticated and session cookie set',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials', type: ApiErrorResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const user = await this.authService.login(dto);
    const session = await this.authService.createSession(user.id, this.sessionContext(request));
    this.cookies.set(response, session.token);

    return { expiresAt: session.expiresAt.toISOString() };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke the current session and clear the cookie (idempotent)' })
  @ApiResponse({
    status: 200,
    description: 'Session revoked if present; cookie cleared',
    type: LogoutResponseDto,
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LogoutResponse> {
    const token = this.cookies.readToken(request);
    if (token) {
      await this.authService.revokeSession(token);
    }
    this.cookies.clear(response);

    return { loggedOut: true };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: 'Get the currently authenticated user with their customer profile' })
  @ApiResponse({
    status: 200,
    description: 'Current user with roles and customer profile',
    type: AuthMeResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ApiErrorResponseDto })
  async me(@CurrentUser() user: AuthUser): Promise<AuthMeResponse> {
    const { profile, identityDocument } = await this.authService.loadCustomerProfile(user.id);
    return { user, profile, identityDocument };
  }

  private sessionContext(request: Request): SessionContext {
    return {
      userAgent: request.get('user-agent'),
      ipAddress: request.ip,
    };
  }
}
