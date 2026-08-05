import { IsString, IsNotEmpty, IsOptional, IsArray, IsEnum, IsDateString, IsMongoId, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({ example: '5f9f1b9b9c9d440000000000', description: 'Workspace ID' })
  @IsMongoId({ message: 'Workspace ID harus berupa valid MongoId' })
  @IsNotEmpty({ message: 'Workspace ID tidak boleh kosong' })
  workspaceId!: string;

  @ApiProperty({ example: 'My First Post', description: 'Title of the post' })
  @IsString()
  @IsNotEmpty({ message: 'Judul post tidak boleh kosong' })
  @MaxLength(100, { message: 'Judul post maksimal 100 karakter' })
  title!: string;

  @ApiProperty({ example: 'Hello World! This is my post', description: 'Post text content' })
  @IsString()
  @IsNotEmpty({ message: 'Konten post tidak boleh kosong' })
  content!: string;

  @ApiProperty({ example: ['/uploads/img1.jpg'], description: 'Array of media URLs', required: false, type: [String] })
  @IsArray()
  @IsOptional()
  mediaUrls?: string[];

  @ApiProperty({ example: 'draft', description: 'Status of the post', required: false, enum: ['draft', 'scheduled', 'published', 'failed'] })
  @IsEnum(['draft', 'scheduled', 'published', 'failed'])
  @IsOptional()
  status?: string;

  @ApiProperty({ example: '2026-12-31T23:59:59Z', description: 'ISO Date string for scheduled time', required: false })
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}

export class UpdatePostDto {
  @ApiProperty({ example: 'Updated title', description: 'Updated post title', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Judul post maksimal 100 karakter' })
  title?: string;

  @ApiProperty({ example: 'Updated post content', description: 'Updated post text content', required: false })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiProperty({ example: ['/uploads/img2.jpg'], description: 'Updated array of media URLs', required: false, type: [String] })
  @IsArray()
  @IsOptional()
  mediaUrls?: string[];

  @ApiProperty({ example: 'draft', description: 'Status of the post', required: false, enum: ['draft', 'scheduled', 'published', 'failed'] })
  @IsEnum(['draft', 'scheduled', 'published', 'failed'])
  @IsOptional()
  status?: string;

  @ApiProperty({ example: '2026-12-31T23:59:59Z', description: 'ISO Date string for scheduled time', required: false })
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}
