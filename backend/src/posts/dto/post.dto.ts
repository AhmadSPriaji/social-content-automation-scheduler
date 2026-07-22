import { IsString, IsNotEmpty, IsOptional, IsArray, IsEnum, IsDateString, IsMongoId } from 'class-validator';

export class CreatePostDto {
  @IsMongoId()
  @IsNotEmpty()
  workspaceId!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsArray()
  @IsOptional()
  mediaUrls?: string[];

  @IsEnum(['draft', 'scheduled', 'published', 'failed'])
  @IsOptional()
  status?: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}

export class UpdatePostDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsArray()
  @IsOptional()
  mediaUrls?: string[];

  @IsEnum(['draft', 'scheduled', 'published', 'failed'])
  @IsOptional()
  status?: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}
