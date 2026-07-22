import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { WorkspaceRole } from '../../workspaces/schemas/workspace.schema';
import { WorkspacesService } from '../../workspaces/workspaces.service';

@Injectable()
export class PostOwnershipGuard implements CanActivate {
  constructor(private reflector: Reflector, private workspacesService: WorkspacesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const workspaceId = request.params.workspaceId || request.body.workspaceId || request.query.workspaceId;

    if (!user || !workspaceId) {
      throw new ForbiddenException('User or Workspace context missing');
    }

    const workspace = await this.workspacesService.findById(workspaceId);
    if (!workspace) {
      throw new ForbiddenException('Workspace not found');
    }

    const member = workspace.members.find((m) => m.userId.toString() === user.id);

    // If user has a sufficient role to bypass ownership check (e.g. they are 'owner')
    // We consider it valid depending on business logic. Usually, 'owner' can edit anything.
    if (member && requiredRoles && requiredRoles.includes(member.role)) {
       return true;
    }

    // ABAC fallback logic: Check if user is the author of the post.
    // The Post entity or authorId must be available in the request or fetched from DB.
    // For now, if request.post (set by a middleware/interceptor) exists, check authorId
    // If not, we will need to inject a PostService to fetch it, but that's for Phase 3.
    // We'll leave a mock check here that looks at request.body.authorId or params
    
    // In Phase 3, you'd fetch the post by id (request.params.id) and check post.authorId === user.id.
    const postId = request.params.id; // assuming /posts/:id
    
    // MOCK ABAC: If we know the user is the author, we allow it.
    // Replace with real DB check in Phase 3
    if (request.body.authorId === user.id || request.post?.authorId?.toString() === user.id) {
       return true;
    }
    
    // Since PostService isn't available yet in Phase 2, we can just return false if RBAC failed.
    throw new ForbiddenException('You do not own this resource and lack sufficient workspace role');
  }
}
