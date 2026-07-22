import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Workspace, WorkspaceRole } from './schemas/workspace.schema';
import { UsersService } from '../users/users.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectModel(Workspace.name) private workspaceModel: Model<Workspace>,
    private usersService: UsersService,
    private auditLogsService: AuditLogsService,
  ) {}

  async findById(id: string): Promise<Workspace | null> {
    return this.workspaceModel.findById(id).exec();
  }

  async findAllForUser(userId: string): Promise<Workspace[]> {
    // Find workspaces where members array contains an object with this userId
    return this.workspaceModel.find({ 'members.userId': new Types.ObjectId(userId) }).exec();
  }

  async getAuditLogs(workspaceId: string) {
    return this.auditLogsService.getLogsForWorkspace(workspaceId);
  }

  async create(name: string, userId: string): Promise<Workspace> {
    const newWorkspace = new this.workspaceModel({
      name,
      members: [{ userId: new Types.ObjectId(userId), role: WorkspaceRole.OWNER }],
    });
    const saved = await newWorkspace.save();

    // Log creation
    await this.auditLogsService.createLog('workspace_created', `Workspace '${name}' created by user ${userId}`, { workspaceId: saved._id.toString() });

    return saved;
  }

  async addMember(workspaceId: string, email: string, role: WorkspaceRole): Promise<Workspace> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User with this email not found');
    }

    const workspace = await this.workspaceModel.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    const userId = user._id.toString();

    // Check if user is already a member
    const existingMember = workspace.members.find((m) => m.userId.toString() === userId);
    if (existingMember) {
      throw new ForbiddenException('User is already a member of this workspace');
    } else {
      workspace.members.push({ userId: new Types.ObjectId(userId), role });
    }

    const saved = await workspace.save();

    // Log member addition
    await this.auditLogsService.createLog('member_added', `User ${email} added as ${role}`, { workspaceId });

    return saved;
  }
}
