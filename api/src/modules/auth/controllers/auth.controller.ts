import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { LoginThrottlerGuard } from '../guards/login-throttler.guard';
import { AuthService } from '../services/auth.service';
import {
  AccountDeletedDto,
  DeleteAccountDto,
  LoginUserDto,
  RegisterUserDto,
  UpdateUserDto,
  UserResponseDto
} from '../dto/auth.dto';

/**
 * User account endpoints. Called only by the trusted web backend (BFF), which authenticates the
 * end user via session cookie and passes the session user as :userName. They require the
 * administrative X-Api-Key like every other non-public route.
 */
@ApiTags('auth')
@ApiSecurity('X-Api-Key')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Shared bucket: requests come from the BFF, not the end user.
  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiOkResponse({ type: UserResponseDto })
  async register(@Body() body: RegisterUserDto): Promise<UserResponseDto> {
    return this.authService.register(body);
  }

  @Post('login')
  @UseGuards(LoginThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 15 * 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with username and password' })
  @ApiOkResponse({ type: UserResponseDto })
  async login(@Body() body: LoginUserDto): Promise<UserResponseDto> {
    return this.authService.login(body);
  }

  @Get('user/:userName')
  @ApiOperation({ summary: 'Get user details by username' })
  @ApiOkResponse({ type: UserResponseDto })
  async getUser(@Param('userName') userName: string): Promise<UserResponseDto> {
    const user = await this.authService.findByUsername(userName);
    if (!user) {
      throw new NotFoundException(`User '${userName}' not found`);
    }
    return user;
  }

  @Patch('user/:userName')
  @ApiOperation({ summary: 'Update user profile and account settings' })
  @ApiOkResponse({ type: UserResponseDto })
  async updateUser(
    @Param('userName') userName: string,
    @Body() body: UpdateUserDto
  ): Promise<UserResponseDto> {
    return this.authService.updateUser(userName, body);
  }

  @Delete('user/:userName')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Delete the account (password required); its displays are released so other accounts can claim them'
  })
  @ApiOkResponse({ type: AccountDeletedDto })
  async deleteAccount(
    @Param('userName') userName: string,
    @Body() body: DeleteAccountDto
  ): Promise<AccountDeletedDto> {
    return this.authService.deleteAccount(userName, body.currentPassword);
  }
}
