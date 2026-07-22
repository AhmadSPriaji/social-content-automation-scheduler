import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: { createdAt: 'timestamp', updatedAt: false } })
export class AuditLog extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Post', required: false })
  postId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: false })
  workspaceId?: Types.ObjectId;

  @Prop({ required: true })
  action: string;

  @Prop({ required: true })
  details: string;

  timestamp: Date; // Automatically managed by timestamps options
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
