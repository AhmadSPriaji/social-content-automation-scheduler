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

      const workspace = await this.workspacesService.findById(post.workspaceId.toString());
      if (!workspace) throw new Error('Workspace not found');

      const redditAccount = workspace.connectedAccounts.find(acc => acc.provider === 'reddit');
      if (!redditAccount) {
        throw new Error('Reddit account not connected to this workspace');
      }

      const accessToken = redditAccount.accessToken;
      // We stored the username in the refresh token field as "username::token"
      const username = redditAccount.refreshToken ? redditAccount.refreshToken.split('::')[0] : '';
      
      if (!username) {
        throw new Error('Could not find Reddit username for this workspace');
      }

      // Use the first 50 characters (or first line) as the title
      const title = post.content.split('\n')[0].substring(0, 50);

      const response = await fetch('https://oauth.reddit.com/api/submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'SocialContentScheduler/1.0.0',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          sr: `u_${username}`,
          kind: 'self',
          title: title,
          text: post.content,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Reddit API Error: ${response.status} - ${errorText}`);
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
        await this.postsService.updateStatus(postId, 'failed');
        await this.auditLogsService.createLog('publish_failed', `Permanent failure after ${attempt} attempts: ${error.message}`, { postId });
      } else {
        await this.auditLogsService.createLog('publish_failed', `Attempt ${attempt} failed: ${error.message}. Retrying...`, { postId });
      }

      // Re-throw to let BullMQ handle the backoff/retry
      throw error;
    }
  }
}
