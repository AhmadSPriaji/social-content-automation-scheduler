import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum WorkspaceRole {
  OWNER = 'owner',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

@Schema({ _id: false })
export class WorkspaceMember {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: WorkspaceRole })
  role: WorkspaceRole;
}

export const WorkspaceMemberSchema =
  SchemaFactory.createForClass(WorkspaceMember);

@Schema({ _id: false })
export class WorkspaceInvitation {
  @Prop({ required: true })
  email: string;

  @Prop({ required: true, enum: WorkspaceRole })
  role: WorkspaceRole;

  @Prop({ default: Date.now })
  invitedAt: Date;
}

export const WorkspaceInvitationSchema =
  SchemaFactory.createForClass(WorkspaceInvitation);

@Schema({ timestamps: true })
export class Workspace extends Document {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ type: [WorkspaceMemberSchema], default: [] })
  members: WorkspaceMember[];

  @Prop({ type: [WorkspaceInvitationSchema], default: [] })
  pendingInvitations: WorkspaceInvitation[];

  @Prop({
    type: [
      {
        provider: { type: String, required: true },
        accessToken: { type: String, required: true },
        refreshToken: { type: String, required: false },
      },
    ],
    default: [],
  })
  connectedAccounts: {
    provider: string;
    accessToken: string;
    refreshToken?: string;
  }[];
}

export const WorkspaceSchema = SchemaFactory.createForClass(Workspace);
