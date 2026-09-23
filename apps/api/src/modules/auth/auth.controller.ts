import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthCookieService } from './auth.cookie';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SessionGuard } from './guards/session.guard';
import type {
  AuthUser,
  AuthUserResponse,
  LoginResponse,
  LogoutResponse,
  SessionContext,
} from './types/auth-user';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookies: AuthCookieService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a customer account' })
  @ApiResponse({ status: 201, description: 'Account created' })
  async register(@Body() dto: RegisterDto): Promise<AuthUserResponse> {
    const user = await this.authService.register(dto);
    return { user };
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiResponse({ status: 200, description: 'Authenticated and session cookie set' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const user = await this.authService.login(dto);
    const session = await this.authService.createSession(user.id, this.sessionContext(request));
    this.cookies.set(response, session.token);

    return {
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        sessionId: `sess_${session.sessionId.replace(/-/g, '')}`,
        expiresAt: session.expiresAt.toISOString(),
      },
    };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke the current session and clear the cookie' })
  @ApiResponse({ status: 200, description: 'Session revoked and cookie cleared' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LogoutResponse> {
    const token = this.cookies.readToken(request);
    if (!token) {
      throw new UnauthorizedException('Đăng xuất thất bại');
    }

    const revoked = await this.authService.revokeSession(token);
    if (!revoked) {
      throw new UnauthorizedException('Đăng xuất thất bại');
    }

    this.cookies.clear(response);

    return {
      success: true,
      message: 'Đăng xuất thành công',
    };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user with roles' })
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  private sessionContext(request: Request): SessionContext {
    return {
      userAgent: request.get('user-agent'),
      ipAddress: request.ip,
    };
  }
}
