import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Workspace, WorkspaceRole } from './schemas/workspace.schema';

@Injectable()
export class WorkspacesService {
  constructor(@InjectModel(Workspace.name) private workspaceModel: Model<Workspace>) {}

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

  async addMember(workspaceId: string, userId: string, role: WorkspaceRole): Promise<Workspace> {
    const workspace = await this.workspaceModel.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

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
