import { Controller, Post, Get, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService, AuthenticatedUser } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { IsEmail, IsString, IsOptional } from 'class-validator';

class LoginDto {
  @IsEmail()
  email: string;
}

class ClerkSyncDto {
  @IsString()
  clerkUserId: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  name?: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email (dev mode)' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email);
  }

  @Public()
  @Post('clerk/sync')
  @ApiOperation({ summary: 'Sync user from Clerk' })
  async clerkSync(@Body() dto: ClerkSyncDto) {
    const user = await this.authService.syncClerkUser(
      dto.clerkUserId,
      dto.email,
      dto.name || dto.email.split('@')[0],
    );
    return user;
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.id);
  }
}
