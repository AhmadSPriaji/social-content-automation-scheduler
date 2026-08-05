import { Controller, Post, Body, Param, UseGuards, Req, Get, Query, Res, Delete, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto, AddMemberDto, UpdateMemberRoleDto, UpdateWorkspaceDto } from './dto/workspaces.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceRolesGuard } from '../common/guards/workspace-roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { WorkspaceRole } from './schemas/workspace.schema';

@ApiTags('Workspaces')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @ApiOperation({ summary: 'Get all workspaces for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Return all workspaces.' })
  @Get()
  async getWorkspaces(@Req() req: any) {
    const userId = req.user.id;
    return this.workspacesService.findAllForUser(userId);
  }

  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiResponse({ status: 201, description: 'Workspace created successfully.' })
  @Post()
  async createWorkspace(@Body() body: CreateWorkspaceDto, @Req() req: any) {
    const userId = req.user.id;
    return this.workspacesService.create(body.name, userId);
  }

  @ApiOperation({ summary: 'Delete a workspace' })
  @ApiResponse({ status: 200, description: 'Workspace deleted successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Not OWNER).' })
  @UseGuards(WorkspaceRolesGuard)
  @Roles(WorkspaceRole.OWNER)
  @Delete(':workspaceId')
  async deleteWorkspace(@Param('workspaceId') workspaceId: string) {
    await this.workspacesService.deleteWorkspace(workspaceId);
    return { message: 'Workspace deleted successfully' };
  }

  @ApiOperation({ summary: 'Update a workspace name' })
  @ApiResponse({ status: 200, description: 'Workspace renamed successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Not OWNER).' })
  @UseGuards(WorkspaceRolesGuard)
  @Roles(WorkspaceRole.OWNER)
  @Patch(':workspaceId')
  async updateWorkspaceName(@Param('workspaceId') workspaceId: string, @Body() body: UpdateWorkspaceDto) {
    return this.workspacesService.updateWorkspaceName(workspaceId, body.name);
  }

  @ApiOperation({ summary: 'Add a member to a workspace' })
  @ApiResponse({ status: 201, description: 'Member added successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Not OWNER).' })
  @ApiResponse({ status: 404, description: 'User or Workspace not found.' })
  @UseGuards(WorkspaceRolesGuard)
  @Roles(WorkspaceRole.OWNER) // Only owners can add members
  @Post(':workspaceId/members')
  async addMember(
    @Param('workspaceId') workspaceId: string,
    @Body() body: AddMemberDto,
  ) {
    return this.workspacesService.addMember(workspaceId, body.email, body.role);
  }

  @ApiOperation({ summary: 'Remove a member from a workspace' })
  @ApiResponse({ status: 200, description: 'Member removed successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Not OWNER).' })
  @UseGuards(WorkspaceRolesGuard)
  @Roles(WorkspaceRole.OWNER)
  @Delete(':workspaceId/members/:userId')
  async removeMember(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
  ) {
    await this.workspacesService.removeMember(workspaceId, userId);
    return { message: 'Member removed successfully' };
  }

  @ApiOperation({ summary: 'Update a member role in a workspace' })
  @ApiResponse({ status: 200, description: 'Member role updated successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Not OWNER).' })
  @UseGuards(WorkspaceRolesGuard)
  @Roles(WorkspaceRole.OWNER)
  @Patch(':workspaceId/members/:userId')
  async updateMemberRole(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Body() body: UpdateMemberRoleDto,
  ) {
    await this.workspacesService.updateMemberRole(workspaceId, userId, body.role);
    return { message: 'Member role updated successfully' };
  }

  @ApiOperation({ summary: 'Get audit logs for a workspace' })
  @ApiResponse({ status: 200, description: 'List of audit logs.' })
  @UseGuards(WorkspaceRolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.EDITOR, WorkspaceRole.VIEWER)
  @Get(':workspaceId/audit-logs')
  async getAuditLogs(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.getAuditLogs(workspaceId);
  }

  @ApiOperation({ summary: 'Simulate Mock OAuth connection' })
  @ApiResponse({ status: 200, description: 'Mock OAuth successful.' })
  @UseGuards(WorkspaceRolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.EDITOR)
  @Post(':workspaceId/integrations/mock-oauth')
  async mockOauth(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.mockOauthConnect(workspaceId);
  }

  @ApiOperation({ summary: 'Generate Reddit OAuth link' })
  @ApiResponse({ status: 200, description: 'Returns URL to redirect to.' })
  @UseGuards(WorkspaceRolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.EDITOR)
  @Get(':workspaceId/reddit/login')
  async redditLogin(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.generateRedditAuthLink(workspaceId);
  }

  @ApiOperation({ summary: 'Reddit OAuth Callback' })
  @ApiResponse({ status: 200, description: 'OAuth callback handled.' })
  @Get('reddit/callback')
  async redditCallback(@Query('state') state: string, @Query('code') code: string) {
    return this.workspacesService.handleRedditCallback(state, code);
  }
}
