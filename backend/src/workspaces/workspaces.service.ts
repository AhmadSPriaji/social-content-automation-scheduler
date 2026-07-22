import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Workspace, WorkspaceRole } from './schemas/workspace.schema';
import { UsersService } from '../users/users.service';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectModel(Workspace.name) private workspaceModel: Model<Workspace>,
    private usersService: UsersService,
  ) {}

  async findById(id: string): Promise<Workspace | null> {
    return this.workspaceModel.findById(id).exec();
  }

  async create(name: string, userId: string): Promise<Workspace> {
    const newWorkspace = new this.workspaceModel({
      name,
      members: [{ userId: new Types.ObjectId(userId), role: WorkspaceRole.OWNER }],
    });
    return newWorkspace.save();
  }

  async addMember(workspaceId: string, email: string, role: WorkspaceRole): Promise<Workspace> {
    const workspace = await this.workspaceModel.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User with this email not found');
    }
    const userId = user._id.toString();

    // Check if user is already a member
    const existingMember = workspace.members.find((m) => m.userId.toString() === userId);
    if (existingMember) {
      existingMember.role = role;
    } else {
      workspace.members.push({ userId: new Types.ObjectId(userId), role });
    }

    return workspace.save();
  }
}
