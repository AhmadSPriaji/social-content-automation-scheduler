import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PostsService } from './posts.service';

@Processor('publish-post')
export class PostProcessor extends WorkerHost {
  private readonly logger = new Logger(PostProcessor.name);

  constructor(private readonly postsService: PostsService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { postId } = job.data;
    this.logger.log(`Processing job ${job.id} for post ${postId} (Attempt ${job.attemptsMade + 1})`);

    try {
      // 1. Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 2. Simulate 20% random failure
      if (Math.random() < 0.2) {
        throw new Error('API Timeout / Connection Refused');
      }

      // 3. Success: Update status to published
      await this.postsService.updateStatus(postId, 'published');
      this.logger.log(`Post ${postId} successfully published.`);
      
      return { status: 'published' };
    } catch (error: any) {
      this.logger.error(`Failed to publish post ${postId}: ${error.message}`);
      
      // Increment retry count in DB
      await this.postsService.incrementRetryCount(postId);

      // If this is the last attempt (job.attemptsMade is 0-indexed, opts.attempts is total)
      if (job.attemptsMade >= (job.opts.attempts || 1) - 1) {
        this.logger.warn(`Max retries reached for post ${postId}. Marking as failed.`);
        await this.postsService.updateStatus(postId, 'failed');
      }

      // Re-throw to let BullMQ handle the backoff/retry
      throw error;
    }
  }
}
