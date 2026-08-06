import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Post, PostDocument } from './schemas/post.schema';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import { Subject } from 'rxjs';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class PostsService {
  public postUpdates$ = new Subject<{ event: string; data: any }>();

  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectQueue('publish-post') private publishQueue: Queue,
    private auditLogsService: AuditLogsService,
  ) {}

  async getAuditLogs(postId: string) {
    return this.auditLogsService.getLogsForPost(postId);
  }

  async create(user: any, createPostDto: CreatePostDto): Promise<Post> {
    const newPost = new this.postModel({
      ...createPostDto,
      authorId: new Types.ObjectId(user.id),
      workspaceId: new Types.ObjectId(createPostDto.workspaceId),
    });
    
    try {
      const saved = await newPost.save();
      await this.auditLogsService.createLog('post_created', `Post "${saved.title}" created by ${user.email}`, { postId: saved._id.toString(), workspaceId: createPostDto.workspaceId });
      
      this.postUpdates$.next({
        event: 'post_created',
        data: saved,
      });

      return saved;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new BadRequestException('Judul post sudah digunakan di workspace ini');
      }
      throw error;
    }
  }

  async findAllByWorkspace(workspaceId: string): Promise<Post[]> {
    return this.postModel.find({ workspaceId: new Types.ObjectId(workspaceId) }).exec();
  }

  async findById(id: string): Promise<PostDocument | null> {
    return this.postModel.findById(id).exec();
  }

  async update(id: string, updatePostDto: UpdatePostDto, user?: any): Promise<Post> {
    const post = await this.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    let additionalUpdates: any = {};
    if (post.status === 'failed') {
      additionalUpdates = { status: 'draft', $unset: { errorReason: 1 } };
      
      // Emit event for real-time updates
      this.postUpdates$.next({
        event: 'post_updated',
        data: { postId: id, status: 'draft' },
      });
    }

    try {
      const updatedPost = await this.postModel
        .findByIdAndUpdate(id, { ...updatePostDto, ...additionalUpdates }, { new: true })
        .exec();

      const userText = user ? ` by ${user.email}` : '';
      await this.auditLogsService.createLog('post_updated', `Post "${updatedPost?.title}" updated${userText}`, { postId: id, workspaceId: updatedPost?.workspaceId.toString() });

      this.postUpdates$.next({
        event: 'post_updated',
        data: updatedPost,
      });

      return updatedPost!;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new BadRequestException('Judul post sudah digunakan di workspace ini');
      }
      throw error;
    }
  }

  async delete(id: string, user?: any): Promise<void> {
    const post = await this.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    await this.postModel.findByIdAndDelete(id).exec();

    const userText = user ? ` by ${user.email}` : '';
    await this.auditLogsService.createLog('post_deleted', `Post "${post.title}" deleted${userText}`, { postId: id, workspaceId: post.workspaceId.toString() });

    this.postUpdates$.next({
      event: 'post_deleted',
      data: { postId: id },
    });
  }

  async updateStatus(id: string, status: string, errorReason?: string): Promise<void> {
    const updateData: any = { status };
    if (errorReason) {
      updateData.errorReason = errorReason;
    }
    await this.postModel.findByIdAndUpdate(id, updateData).exec();
    
    // Emit event for real-time updates
    this.postUpdates$.next({
      event: 'post_updated',
      data: { postId: id, status, errorReason },
    });
  }

  async incrementRetryCount(id: string): Promise<void> {
    await this.postModel.findByIdAndUpdate(id, { $inc: { retryCount: 1 } }).exec();
  }

  async schedulePost(id: string, user?: any): Promise<void> {
    const post = await this.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    if (!post.scheduledAt) {
      throw new BadRequestException('Post does not have a scheduledAt date');
    }

    const delay = Math.max(0, post.scheduledAt.getTime() - Date.now());

    await this.updateStatus(id, 'scheduled');
    const userText = user ? ` by ${user.email}` : '';
    await this.auditLogsService.createLog('post_scheduled', `Post "${post.title}" scheduled for publication at ${post.scheduledAt.toISOString()}${userText}`, { postId: id, workspaceId: post.workspaceId.toString() });

    // updateStatus already emits post_updated. We just need to make sure the queue works.

    // Remove any existing job for this post (useful for rescheduling)
    const existingJob = await this.publishQueue.getJob(`post-${id}`);
    if (existingJob) {
      await existingJob.remove();
    }

    await this.publishQueue.add(
      'publish',
      { postId: id },
      {
        jobId: `post-${id}`,
        delay,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );
  }

  async cancelSchedule(id: string, user?: any): Promise<void> {
    const post = await this.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    if (post.status !== 'scheduled') {
      throw new BadRequestException('Only scheduled posts can be cancelled');
    }

    // Remove the job from the queue
    const job = await this.publishQueue.getJob(`post-${id}`);
    if (job) {
      await job.remove();
    }

    // Revert status to draft and remove scheduledAt
    await this.postModel.findByIdAndUpdate(id, {
      $unset: { scheduledAt: 1 },
      $set: { status: 'draft' }
    }).exec();

    const userText = user ? ` by ${user.email}` : '';
    await this.auditLogsService.createLog('post_schedule_cancelled', `Schedule for post "${post.title}" cancelled${userText}`, { postId: id, workspaceId: post.workspaceId.toString() });

    // Emit real-time event
    this.postUpdates$.next({
      event: 'post_updated',
      data: { postId: id, status: 'draft' },
    });
  }

  async publishNow(id: string, user?: any): Promise<void> {
    const post = await this.findById(id);
    if (!post) throw new NotFoundException(`Post with ID ${id} not found`);
    
    await this.postModel.findByIdAndUpdate(id, {
      $unset: { scheduledAt: 1, errorReason: 1 },
      $set: { status: 'scheduled' }
    }).exec();

    this.postUpdates$.next({
      event: 'post_updated',
      data: { postId: id, status: 'scheduled' },
    });

    const existingJob = await this.publishQueue.getJob(`post-${id}`);
    if (existingJob) {
      await existingJob.remove();
    }

    await this.publishQueue.add(
      'publish',
      { postId: id },
      {
        jobId: `post-${id}`,
        delay: 0,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    const userText = user ? ` by ${user.email}` : '';
    await this.auditLogsService.createLog('post_publish_now', `Post "${post.title}" submitted for immediate publication${userText}`, { postId: id, workspaceId: post.workspaceId.toString() });
  }

  async duplicate(id: string, userId: string): Promise<Post> {
    const post = await this.findById(id);
    if (!post) throw new NotFoundException(`Post with ID ${id} not found`);

    const duplicatedPost = new this.postModel({
      workspaceId: post.workspaceId,
      authorId: new Types.ObjectId(userId),
      title: `${post.title} (Copy ${Date.now().toString().slice(-4)})`,
      content: post.content,
      mediaUrls: [...post.mediaUrls],
      status: 'draft',
    });

    const saved = await duplicatedPost.save();

    await this.auditLogsService.createLog('post_duplicated', `Post duplicated from ${id}`, { postId: saved._id.toString() });

    this.postUpdates$.next({
      event: 'post_created',
      data: saved,
    });

    return saved;
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
      await this.updateStatus(id, 'failed', payload.details);
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

    return {
      views: 0,
      likes: 0,
      shares: 0,
      comments: 0,
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
