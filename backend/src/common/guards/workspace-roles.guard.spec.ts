import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { WorkspaceRolesGuard } from './workspace-roles.guard';
import { Reflector } from '@nestjs/core';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { WorkspaceRole } from '../../workspaces/schemas/workspace.schema';

describe('WorkspaceRolesGuard', () => {
  let guard: WorkspaceRolesGuard;
  let reflector: jest.Mocked<Reflector>;
  let workspacesService: jest.Mocked<WorkspacesService>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;
    workspacesService = {
      findById: jest.fn(),
    } as any;
    guard = new WorkspaceRolesGuard(reflector, workspacesService);
  });

  const createMockContext = (
    userId: string,
    workspaceId: string,
  ): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { id: userId },
          params: { workspaceId },
          body: {},
          query: {},
        }),
      }),
    } as any;
  };

  it('should return true if no roles are required', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = createMockContext('user1', 'ws1');

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('should throw ForbiddenException if user or workspaceId is missing', async () => {
    reflector.getAllAndOverride.mockReturnValue([WorkspaceRole.OWNER]);
    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: null, // missing user
          params: {},
        }),
      }),
    } as any;

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if workspace not found', async () => {
    reflector.getAllAndOverride.mockReturnValue([WorkspaceRole.OWNER]);
    const ctx = createMockContext('user1', 'ws1');
    workspacesService.findById.mockResolvedValue(null);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if user is not in workspace', async () => {
    reflector.getAllAndOverride.mockReturnValue([WorkspaceRole.OWNER]);
    const ctx = createMockContext('user1', 'ws1');
    workspacesService.findById.mockResolvedValue({
      members: [{ userId: { toString: () => 'user2' }, role: WorkspaceRole.OWNER }],
    } as any);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if user has insufficient role', async () => {
    reflector.getAllAndOverride.mockReturnValue([WorkspaceRole.OWNER]);
    const ctx = createMockContext('user1', 'ws1');
    workspacesService.findById.mockResolvedValue({
      members: [{ userId: { toString: () => 'user1' }, role: WorkspaceRole.VIEWER }],
    } as any);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should return true if user has required role', async () => {
    reflector.getAllAndOverride.mockReturnValue([WorkspaceRole.OWNER, WorkspaceRole.EDITOR]);
    const ctx = createMockContext('user1', 'ws1');
    workspacesService.findById.mockResolvedValue({
      members: [{ userId: { toString: () => 'user1' }, role: WorkspaceRole.EDITOR }],
    } as any);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
