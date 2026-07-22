import { Controller, Post, Body, HttpCode, HttpStatus, Res, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Response, Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body.email, body.password);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Login a user and set cookies' })
  @ApiResponse({ status: 200, description: 'Logged in successfully' })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.login(body.email, body.password);
    this.setCookies(res, tokens.accessToken, tokens.refreshToken);
    return { message: 'Logged in successfully' };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refreshToken'];
    if (!refreshToken) throw new UnauthorizedException('No refresh token provided');

    const tokens = await this.authService.refresh(refreshToken);
    this.setCookies(res, tokens.accessToken, tokens.refreshToken);
    return { message: 'Token refreshed successfully' };
  }

  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refreshToken'];
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return { message: 'Logged out successfully' };
  }

  private setCookies(res: Response, accessToken: string, refreshToken: string) {
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }
}
