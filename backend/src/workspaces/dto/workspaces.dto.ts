import { IsString, IsNotEmpty, IsEnum, IsEmail } from 'class-validator';
import { WorkspaceRole } from '../schemas/workspace.schema';

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty({ message: 'Name cannot be empty' })
  name: string;
}

export class AddMemberDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email cannot be empty' })
  email: string;

  @IsEnum(WorkspaceRole, { message: 'Role must be owner, editor, or viewer' })
  role: WorkspaceRole;
}
