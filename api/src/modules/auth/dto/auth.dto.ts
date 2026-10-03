import { AbstractDto } from '../../shared-modules/abstract/lib';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf
} from 'class-validator';

/** bcrypt silently truncates input beyond 72 bytes, so longer passwords are rejected outright. */
const PASSWORD_MAX_LENGTH = 72;
const USERNAME_PATTERN = /^[a-z0-9_.-]{3,32}$/;

const normalizeUserName = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const isSet = (v: unknown): boolean => v !== undefined && v !== null && v !== '';

export class RegisterUserDto {
  @ApiProperty({
    example: 'johndoe',
    description: 'Unique username (3-32 chars: a-z, 0-9, _ . -). Stored lowercase and immutable.'
  })
  @Transform(normalizeUserName)
  @IsString()
  @Matches(USERNAME_PATTERN, {
    message: 'userName must be 3-32 characters and contain only a-z, 0-9, underscore, dot or dash'
  })
  userName!: string;

  @ApiProperty({ example: 'supersecret', description: 'User password (6-72 chars)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}

export class LoginUserDto {
  @ApiProperty({ example: 'johndoe', description: 'Username' })
  @Transform(normalizeUserName)
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  userName!: string;

  @ApiProperty({ example: 'supersecret', description: 'Password' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}

/**
 * Self-service profile update.
 *
 * Deliberately excludes username and role: usernames are the stable identity that devices
 * and sessions are bound to, and privilege changes must never be reachable through a
 * user-facing endpoint.
 */
export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'Current password (required together with newPassword)' })
  @IsOptional()
  @IsString()
  @MaxLength(PASSWORD_MAX_LENGTH)
  currentPassword?: string;

  @ApiPropertyOptional({ description: 'New password (6-72 chars)' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(PASSWORD_MAX_LENGTH)
  newPassword?: string;

  @ApiPropertyOptional({
    description: 'Profile link (http/https). Empty string or null clears it.'
  })
  @ValidateIf((o: UpdateUserDto) => isSet(o.socialUrl))
  @IsString()
  @MaxLength(512)
  @Matches(/^https?:\/\/[^\s<>"']+$/i, { message: 'socialUrl must be an http(s) URL' })
  socialUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Avatar image URL (http/https). Empty string or null clears it.'
  })
  @ValidateIf((o: UpdateUserDto) => isSet(o.avatarUrl))
  @IsString()
  @MaxLength(512)
  @Matches(/^(https?:\/\/[^\s<>"']+|\/[A-Za-z0-9._/-]+)$/i, {
    message: 'avatarUrl must be an http(s) URL or a local /path'
  })
  avatarUrl?: string | null;
}

export class UserResponseDto extends AbstractDto {
  @ApiProperty()
  userName!: string;

  @ApiProperty()
  role!: string;

  @ApiPropertyOptional()
  socialUrl?: string | null;

  @ApiPropertyOptional()
  avatarUrl?: string | null;
}

export class DeleteAccountDto {
  @ApiProperty({ description: 'Current password, required to delete the account' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  currentPassword!: string;
}

export class AccountDeletedDto {
  @ApiProperty({ description: 'Displays released for other accounts to claim', example: 2 })
  releasedDevices!: number;
}
