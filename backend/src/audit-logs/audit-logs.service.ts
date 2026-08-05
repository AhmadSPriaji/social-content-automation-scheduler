import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog } from './schemas/audit-log.schema';

@Injectable()
export class AuditLogsService {
  constructor(@InjectModel(AuditLog.name) private auditLogModel: Model<AuditLog>) {}

  async createLog(
    action: string,
    details: string,
    options?: { postId?: string; workspaceId?: string }
  ): Promise<AuditLog> {
    const newLog = new this.auditLogModel({
      action,
      details,
    });
    if (options?.postId) newLog.postId = new Types.ObjectId(options.postId);
    if (options?.workspaceId) newLog.workspaceId = new Types.ObjectId(options.workspaceId);
    return newLog.save();
  }

  async getLogsForWorkspace(workspaceId: string): Promise<AuditLog[]> {
    return this.auditLogModel
      .find({ workspaceId: new Types.ObjectId(workspaceId) })
      .sort({ timestamp: -1 })
      .exec();
  }

  async getLogsForPost(postId: string): Promise<AuditLog[]> {
    return this.auditLogModel
      .find({ postId: new Types.ObjectId(postId) })
      .sort({ timestamp: -1 })
      .exec();
  }

  async deleteLogsForWorkspace(workspaceId: string): Promise<void> {
    await this.auditLogModel.deleteMany({ workspaceId: new Types.ObjectId(workspaceId) }).exec();
  }
}
