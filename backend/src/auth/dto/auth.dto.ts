import { IsEmail, IsNotEmpty, IsString, MinLength, Matches, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty({ message: 'Email tidak boleh kosong' })
  email!: string;

  @ApiProperty({ example: 'Password123', description: 'User password (min 6 chars, with uppercase, lowercase, and number)' })
  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, { message: 'Password harus mengandung huruf besar, huruf kecil, dan angka' })
  @IsNotEmpty({ message: 'Password tidak boleh kosong' })
  password!: string;

  @ApiProperty({ example: 'Ahmad Priaji', description: 'Full name of the user', required: false })
  @IsOptional()
  @IsString()
  name?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty({ message: 'Email tidak boleh kosong' })
  email!: string;

  @ApiProperty({ example: 'Password123', description: 'User password' })
  @IsString()
  @IsNotEmpty({ message: 'Password tidak boleh kosong' })
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'Refresh token string' })
  @IsString()
  @IsNotEmpty({ message: 'Refresh token tidak boleh kosong' })
  refreshToken!: string;
}
