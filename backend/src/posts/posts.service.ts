import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Post, PostDocument } from './schemas/post.schema';
import { Cron, CronExpression } from '@nestjs/schedule';
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

  async getDeadLetters(workspaceId: string): Promise<Post[]> {
    return this.postModel.find({ 
      workspaceId: new Types.ObjectId(workspaceId),
      status: 'failed',
    }).exec();
  }

  async generateAiCaption(prompt: string): Promise<{ caption: string }> {
    // This is a mock AI generation. In a real integration, this would call OpenAI or another LLM API.
    const mockCaptions = [
      `Check out our latest update! #innovation #${prompt.replace(/\s+/g, '')}`,
      `Exciting news to share about ${prompt} today. Stay tuned for more details!`,
      `We've been working hard on ${prompt}. Here's what you need to know. 🚀`,
      `Did you know? ${prompt} is changing the way we work. #trends`,
    ];
    
    // Simulate slight delay for AI processing
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const randomCaption = mockCaptions[Math.floor(Math.random() * mockCaptions.length)];
    return { caption: randomCaption };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleCronAnalyticsSync() {
    // Simulate pulling real analytics periodically for all published posts
    const publishedPosts = await this.postModel.find({ status: 'published' }).exec();
    
    for (const post of publishedPosts) {
      // In real scenario, we would make a call to the connected provider API
      // Here we just log to show the cron is working
      // console.log(`Syncing analytics for post ${post._id}`);
      // And we might update the DB with new analytics numbers if we stored them in the DB
    }
  }
}
