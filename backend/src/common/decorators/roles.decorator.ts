import { SetMetadata } from '@nestjs/common';
import { WorkspaceRole } from '../../workspaces/schemas/workspace.schema';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: WorkspaceRole[]) => SetMetadata(ROLES_KEY, roles);
