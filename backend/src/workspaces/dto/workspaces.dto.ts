import { IsString, IsNotEmpty, IsEnum, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceRole } from '../schemas/workspace.schema';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'My Workspace', description: 'Name of the workspace' })
  @IsString()
  @IsNotEmpty({ message: 'Name cannot be empty' })
  name: string;
}

export class AddMemberDto {
  @ApiProperty({ example: 'user2@example.com', description: 'Email of the user to add' })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email cannot be empty' })
  email: string;

  @ApiProperty({ example: 'editor', description: 'Role of the member', enum: WorkspaceRole })
  @IsEnum(WorkspaceRole, { message: 'Role must be owner, editor, or viewer' })
  role: WorkspaceRole;
}
