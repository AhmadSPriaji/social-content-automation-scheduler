import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { WorkspaceRole } from '../../workspaces/schemas/workspace.schema';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { PostsService } from '../../posts/posts.service';

@Injectable()
export class PostOwnershipGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private workspacesService: WorkspacesService,
    private postsService: PostsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const postId = request.params.id;

    if (!user) {
      throw new ForbiddenException('User context missing');
    }

    if (!postId) {
      throw new ForbiddenException('Post ID missing from parameters');
    }

    const post = await this.postsService.findById(postId);
    if (!post) {
      throw new ForbiddenException('Post not found');
    }

    const workspaceId = post.workspaceId.toString();
    const workspace = await this.workspacesService.findById(workspaceId);
    if (!workspace) {
      throw new ForbiddenException('Workspace not found');
    }

    const member = workspace.members.find(
      (m) => m.userId.toString() === user.id,
    );

    // If user has a sufficient role to bypass ownership check (e.g. they are ADMIN or EDITOR)
    if (member && requiredRoles && requiredRoles.includes(member.role)) {
      return true;
    }

    // ABAC fallback logic: Check if user is the author of the post.
    if (post.authorId.toString() === user.id) {
      return true;
    }

    throw new ForbiddenException(
      'You do not own this resource and lack sufficient workspace role',
    );
  }
}
