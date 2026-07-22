import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { WorkspaceRole } from '../../workspaces/schemas/workspace.schema';
import { WorkspacesService } from '../../workspaces/workspaces.service';

@Injectable()
export class WorkspaceRolesGuard implements CanActivate {
  constructor(private reflector: Reflector, private workspacesService: WorkspacesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true; // No roles restricted
    }
    
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // Assumes workspaceId is sent in body, query, or params
    const workspaceId = request.params?.workspaceId || request.body?.workspaceId || request.query?.workspaceId;

    if (!user || !workspaceId) {
      throw new ForbiddenException('User or Workspace context missing');
    }

    const workspace = await this.workspacesService.findById(workspaceId);
    if (!workspace) {
      throw new ForbiddenException('Workspace not found');
    }

    const member = workspace.members.find((m) => m.userId.toString() === user.id);
    
    if (!member || !requiredRoles.includes(member.role)) {
      throw new ForbiddenException('Insufficient permissions in this workspace');
    }

    return true;
  }
}
