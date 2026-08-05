import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PostsService } from './posts.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

@Processor('publish-post')
export class PostProcessor extends WorkerHost {
  private readonly logger = new Logger(PostProcessor.name);

  constructor(
    private readonly postsService: PostsService,
    private readonly auditLogsService: AuditLogsService,
    private readonly workspacesService: WorkspacesService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { postId } = job.data;
    const attempt = job.attemptsMade + 1;
    this.logger.log(`Processing job ${job.id} for post ${postId} (Attempt ${attempt})`);
    await this.auditLogsService.createLog('publish_attempt', `Attempt ${attempt} to publish post`, { postId });

    try {
      const post = await this.postsService.findById(postId);
      if (!post) throw new Error('Post not found');

      // DUMMY LOGIC: Randomly succeed or fail
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));

      const isSuccess = Math.random() > 0.5;


      if (!isSuccess) {
        const errorReasons = [
          'Platform rate limit exceeded',
          'Account disconnected',
          'Media format not supported by platform',
          'Post content violates community guidelines',
          'Network timeout during upload'
        ];
        const randomError = errorReasons[Math.floor(Math.random() * errorReasons.length)];
        throw new Error(randomError);
      }

      // 3. Success: Update status to published
      await this.postsService.updateStatus(postId, 'published');
      this.logger.log(`Post ${postId} successfully published.`);
      await this.auditLogsService.createLog('publish_success', `Post published successfully on attempt ${attempt}`, { postId });

      return { status: 'published' };
    } catch (error: any) {
      this.logger.error(`Failed to publish post ${postId}: ${error.message}`);

      // Increment retry count in DB
      await this.postsService.incrementRetryCount(postId);

      // If this is the last attempt (job.attemptsMade is 0-indexed, opts.attempts is total)
      if (job.attemptsMade >= (job.opts.attempts || 1) - 1) {
        this.logger.warn(`Max retries reached for post ${postId}. Marking as failed.`);
        await this.postsService.updateStatus(postId, 'failed', error.message);
        await this.auditLogsService.createLog('publish_failed', `Permanent failure after ${attempt} attempts: ${error.message}`, { postId });
      } else {
        await this.auditLogsService.createLog('publish_failed', `Attempt ${attempt} failed: ${error.message}. Retrying...`, { postId });
      }

      // Re-throw to let BullMQ handle the backoff/retry
      throw error;
    }
  }
}
