import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PostDocument = Post & Document;

@Schema({ timestamps: true })
export class Post {
  @Prop({ type: Types.ObjectId, required: true, ref: 'Workspace' })
  workspaceId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  authorId!: Types.ObjectId;

  @Prop({ required: true })
  content!: string;

  @Prop({ type: [String], default: [] })
  mediaUrls!: string[];

  @Prop({
    type: String,
    enum: ['draft', 'scheduled', 'published', 'failed'],
    default: 'draft',
  })
  status!: string;

  @Prop({ type: Date })
  scheduledAt?: Date;

  @Prop({ type: Number, default: 0 })
  retryCount!: number;
}

export const PostSchema = SchemaFactory.createForClass(Post);
