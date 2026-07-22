import { IsString, IsNotEmpty, IsEnum, IsMongoId } from 'class-validator';
import { WorkspaceRole } from '../schemas/workspace.schema';

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty({ message: 'Name cannot be empty' })
  name: string;
}

export class AddMemberDto {
  @IsMongoId({ message: 'Invalid user ID format' })
  @IsNotEmpty({ message: 'User ID cannot be empty' })
  userId: string;

  @IsEnum(WorkspaceRole, { message: 'Role must be owner, editor, or viewer' })
  role: WorkspaceRole;
}
