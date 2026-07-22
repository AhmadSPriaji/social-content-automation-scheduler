import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog } from './schemas/audit-log.schema';

@Injectable()
export class AuditLogsService {
  constructor(@InjectModel(AuditLog.name) private auditLogModel: Model<AuditLog>) {}

  async createLog(postId: string, action: string, details: string): Promise<AuditLog> {
    const newLog = new this.auditLogModel({
      postId: new Types.ObjectId(postId),
      action,
      details,
    });
    return newLog.save();
  }

  async getLogsForPost(postId: string): Promise<AuditLog[]> {
    return this.auditLogModel
      .find({ postId: new Types.ObjectId(postId) })
      .sort({ timestamp: -1 })
      .exec();
  }
}
