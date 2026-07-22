import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Post, PostDocument } from './schemas/post.schema';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectQueue('publish-post') private publishQueue: Queue,
    private auditLogsService: AuditLogsService,
  ) {}

  async getAuditLogs(postId: string) {
    return this.auditLogsService.getLogsForPost(postId);
  }

  async create(authorId: string, createPostDto: CreatePostDto): Promise<Post> {
    const newPost = new this.postModel({
      ...createPostDto,
      authorId: new Types.ObjectId(authorId),
      workspaceId: new Types.ObjectId(createPostDto.workspaceId),
    });
    const saved = await newPost.save();

    await this.auditLogsService.createLog('post_created', `Post created by user ${authorId}`, { postId: saved._id.toString() });

    return saved;
  }

  async findAllByWorkspace(workspaceId: string): Promise<Post[]> {
    return this.postModel.find({ workspaceId: new Types.ObjectId(workspaceId) }).exec();
  }

  async findById(id: string): Promise<PostDocument | null> {
    return this.postModel.findById(id).exec();
  }

  async update(id: string, updatePostDto: UpdatePostDto): Promise<Post> {
    const updatedPost = await this.postModel
      .findByIdAndUpdate(id, updatePostDto, { new: true })
      .exec();
    if (!updatedPost) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    await this.auditLogsService.createLog('post_updated', `Post updated`, { postId: id });

    return updatedPost;
  }

  async delete(id: string): Promise<void> {
    const result = await this.postModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    await this.auditLogsService.createLog('post_deleted', `Post deleted`, { postId: id });
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.postModel.findByIdAndUpdate(id, { status }).exec();
  }

  async incrementRetryCount(id: string): Promise<void> {
    await this.postModel.findByIdAndUpdate(id, { $inc: { retryCount: 1 } }).exec();
  }

  async schedulePost(id: string): Promise<void> {
    const post = await this.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    if (!post.scheduledAt) {
      throw new BadRequestException('Post does not have a scheduledAt date');
    }

    const delay = Math.max(0, post.scheduledAt.getTime() - Date.now());

    await this.updateStatus(id, 'scheduled');
    await this.auditLogsService.createLog('post_scheduled', `Post scheduled for publication at ${post.scheduledAt.toISOString()}`, { postId: id });

    await this.publishQueue.add(
      'publish',
      { postId: id },
      {
        delay,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );
  }

  async handleWebhook(id: string, payload: { event: string; details: string }) {
    const post = await this.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    // Log the webhook in the audit trail
    await this.auditLogsService.createLog(
      'webhook_received',
      `Webhook event '${payload.event}': ${payload.details}`,
      { postId: id },
    );

    // React to the webhook (e.g. if the external platform banned the post)
    if (payload.event === 'banned' || payload.event === 'failed') {
      await this.updateStatus(id, 'failed');
    } else if (payload.event === 'success' && post.status !== 'published') {
      await this.updateStatus(id, 'published');
    }

    return { message: 'Webhook processed successfully' };
  }

  async getMockAnalytics(id: string) {
    const post = await this.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    // Generate random but "believable" numbers for analytics
    const baseViews = Math.floor(Math.random() * 5000) + 100;
    
    return {
      views: baseViews,
      likes: Math.floor(baseViews * (Math.random() * 0.15 + 0.05)), // 5-20% of views
      shares: Math.floor(baseViews * (Math.random() * 0.05 + 0.01)), // 1-6% of views
      comments: Math.floor(baseViews * (Math.random() * 0.08 + 0.02)), // 2-10% of views
    };
  }
}
