import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PostOwnershipGuard } from './post-ownership.guard';
import { PostsService } from '../../posts/posts.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { WorkspaceRole } from '../../workspaces/schemas/workspace.schema';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('PostOwnershipGuard', () => {
  let guard: PostOwnershipGuard;
  let postsService: any;
  let workspacesService: any;
  let reflector: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostOwnershipGuard,
        {
          provide: PostsService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: WorkspacesService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn().mockReturnValue([WorkspaceRole.OWNER, WorkspaceRole.EDITOR]),
          },
        },
      ],
    }).compile();

    guard = module.get<PostOwnershipGuard>(PostOwnershipGuard);
    postsService = module.get(PostsService);
    workspacesService = module.get(WorkspacesService);
    reflector = module.get(Reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  const createMockContext = (userId: string, postId: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: userId },
          params: { id: postId },
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext);

  it('should return true if user is the author of the post', async () => {
    const ctx = createMockContext('user123', 'post123');
    postsService.findById.mockResolvedValue({ authorId: { toString: () => 'user123' }, workspaceId: { toString: () => 'ws123' } });
    workspacesService.findById.mockResolvedValue({ members: [{ userId: { toString: () => 'user123' }, role: WorkspaceRole.VIEWER }] });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should return true if user is not author but is an OWNER of the workspace', async () => {
    const ctx = createMockContext('user456', 'post123');
    postsService.findById.mockResolvedValue({ authorId: { toString: () => 'user123' }, workspaceId: { toString: () => 'ws123' } });
    workspacesService.findById.mockResolvedValue({ members: [{ userId: { toString: () => 'user456' }, role: WorkspaceRole.OWNER }] });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException if user is not author and is only a VIEWER', async () => {
    const ctx = createMockContext('user456', 'post123');
    postsService.findById.mockResolvedValue({ authorId: { toString: () => 'user123' }, workspaceId: { toString: () => 'ws123' } });
    workspacesService.findById.mockResolvedValue({ members: [{ userId: { toString: () => 'user456' }, role: WorkspaceRole.VIEWER }] });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if user is not a member of the workspace', async () => {
    const ctx = createMockContext('user456', 'post123');
    postsService.findById.mockResolvedValue({ authorId: { toString: () => 'user123' }, workspaceId: { toString: () => 'ws123' } });
    workspacesService.findById.mockResolvedValue({ members: [] });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if post does not exist', async () => {
    const ctx = createMockContext('user456', 'post123');
    postsService.findById.mockResolvedValue(null);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
