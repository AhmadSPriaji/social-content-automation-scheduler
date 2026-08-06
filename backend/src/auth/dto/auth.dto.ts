import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  Matches,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty({ message: 'Email tidak boleh kosong' })
  email!: string;

  @ApiProperty({
    example: 'Password123',
    description:
      'User password (min 6 chars, with uppercase, lowercase, and number)',
  })
  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password harus mengandung huruf besar, huruf kecil, dan angka',
  })
  @IsNotEmpty({ message: 'Password tidak boleh kosong' })
  password!: string;

  @ApiProperty({
    example: 'Ahmad Priaji',
    description: 'Full name of the user',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;
}

export class LoginDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty({ message: 'Email tidak boleh kosong' })
  email!: string;

  @ApiProperty({ example: 'Password123', description: 'User password' })
  @IsString()
  @IsNotEmpty({ message: 'Password tidak boleh kosong' })
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Refresh token string',
  })
  @IsString()
  @IsNotEmpty({ message: 'Refresh token tidak boleh kosong' })
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address to reset password',
  })
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty({ message: 'Email tidak boleh kosong' })
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    example: 'some-random-token',
    description: 'The reset password token received via email',
  })
  @IsString()
  @IsNotEmpty({ message: 'Token tidak boleh kosong' })
  token!: string;

  @ApiProperty({
    example: 'NewPassword123',
    description:
      'New user password (min 6 chars, with uppercase, lowercase, and number)',
  })
  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password harus mengandung huruf besar, huruf kecil, dan angka',
  })
  @IsNotEmpty({ message: 'Password tidak boleh kosong' })
  newPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    example: 'OldPassword123',
    description: 'Current user password',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password lama tidak boleh kosong' })
  oldPassword!: string;

  @ApiProperty({
    example: 'NewPassword123',
    description:
      'New user password (min 6 chars, with uppercase, lowercase, and number)',
  })
  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password harus mengandung huruf besar, huruf kecil, dan angka',
  })
  @IsNotEmpty({ message: 'Password tidak boleh kosong' })
  newPassword!: string;
}
