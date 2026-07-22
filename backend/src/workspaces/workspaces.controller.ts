import { Controller, Post, Body, Param, UseGuards, Req, Get } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto, AddMemberDto } from './dto/workspaces.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceRolesGuard } from '../common/guards/workspace-roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { WorkspaceRole } from './schemas/workspace.schema';

@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  async getWorkspaces(@Req() req: any) {
    const userId = req.user.id;
    return this.workspacesService.findAllForUser(userId);
  }

  @Post()
  async createWorkspace(@Body() body: CreateWorkspaceDto, @Req() req: any) {
    const userId = req.user.id;
    return this.workspacesService.create(body.name, userId);
  }

  @UseGuards(WorkspaceRolesGuard)
  @Roles(WorkspaceRole.OWNER) // Only owners can add members
  @Post(':workspaceId/members')
  async addMember(
    @Param('workspaceId') workspaceId: string,
    @Body() body: AddMemberDto,
  ) {
    return this.workspacesService.addMember(workspaceId, body.email, body.role);
  }
}
