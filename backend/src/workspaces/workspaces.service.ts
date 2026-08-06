import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Workspace, WorkspaceRole } from './schemas/workspace.schema';
import { Post } from '../posts/schemas/post.schema';
import { UsersService } from '../users/users.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { EncryptionService } from '../common/services/encryption.service';

@Injectable()
export class WorkspacesService {
  private redisClient: Redis;

  constructor(
    @InjectModel(Workspace.name) private workspaceModel: Model<Workspace>,
    @InjectModel(Post.name) private postModel: Model<Post>,
    @InjectQueue('publish-post') private publishQueue: Queue,
    private usersService: UsersService,
    private auditLogsService: AuditLogsService,
    private configService: ConfigService,
    private mailerService: MailerService,
    private encryptionService: EncryptionService,
  ) {
    this.redisClient = new Redis(
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379',
    );
  }

  async findById(id: string): Promise<Workspace | null> {
    return this.workspaceModel.findById(id).exec();
  }

  async findAllForUser(userId: string): Promise<Workspace[]> {
    // Find workspaces where members array contains an object with this userId
    return this.workspaceModel
      .find({ 'members.userId': new Types.ObjectId(userId) })
      .populate('members.userId', 'email name')
      .exec();
  }

  async getPendingInvitations(email: string): Promise<Workspace[]> {
    return this.workspaceModel
      .find({ 'pendingInvitations.email': email })
      .select('name pendingInvitations') // Only return necessary fields
      .exec();
  }

  async getInvitationDetails(workspaceId: string, email: string): Promise<any> {
    const workspace = await this.workspaceModel.findById(workspaceId);
    if (!workspace) throw new NotFoundException('Workspace not found');

    const invite = workspace.pendingInvitations.find(
      (inv) => inv.email === email,
    );
    if (!invite) throw new NotFoundException('Invitation not found');

    return {
      workspaceId: workspace._id,
      name: workspace.name,
      role: invite.role,
      invitedAt: invite.invitedAt,
    };
  }

  async getAuditLogs(workspaceId: string) {
    return this.auditLogsService.getLogsForWorkspace(workspaceId);
  }

  async create(name: string, userId: string): Promise<Workspace> {
    const newWorkspace = new this.workspaceModel({
      name,
      members: [
        { userId: new Types.ObjectId(userId), role: WorkspaceRole.OWNER },
      ],
    });

    try {
      const saved = await newWorkspace.save();

      // Log creation
      await this.auditLogsService.createLog(
        'workspace_created',
        `Workspace '${name}' created by user ${userId}`,
        { workspaceId: saved._id.toString() },
      );

      return saved;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new BadRequestException('Workspace name already exists');
      }
      throw error;
    }
  }

  async updateWorkspaceName(
    workspaceId: string,
    name: string,
  ): Promise<Workspace> {
    try {
      const workspace = await this.workspaceModel.findByIdAndUpdate(
        workspaceId,
        { name },
        { new: true },
      );
      if (!workspace) throw new NotFoundException('Workspace not found');

      await this.auditLogsService.createLog(
        'workspace_updated',
        `Workspace name changed to '${name}'`,
        { workspaceId },
      );
      return workspace;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new BadRequestException('Workspace name already exists');
      }
      throw error;
    }
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    const workspace = await this.workspaceModel.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // 0. Remove scheduled jobs
    const posts = await this.postModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
    });
    for (const post of posts) {
      const job = await this.publishQueue.getJob(`post-${post._id}`);
      if (job) {
        await job.remove();
      }
    }

    // 1. Delete all posts
    await this.postModel
      .deleteMany({ workspaceId: new Types.ObjectId(workspaceId) })
      .exec();

    // 2. Delete all audit logs
    await this.auditLogsService.deleteLogsForWorkspace(workspaceId);

    // 3. Delete workspace
    await this.workspaceModel.findByIdAndDelete(workspaceId).exec();
  }

  async addMember(
    workspaceId: string,
    email: string,
    role: WorkspaceRole,
  ): Promise<Workspace> {
    const workspace = await this.workspaceModel.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Check if user is already a member
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      const existingMember = workspace.members.find(
        (m) => m.userId.toString() === existingUser._id.toString(),
      );
      if (existingMember) {
        throw new ForbiddenException(
          'User is already a member of this workspace',
        );
      }
    }

    // Check if already invited
    const existingInvite = workspace.pendingInvitations.find(
      (inv) => inv.email === email,
    );
    if (existingInvite) {
      throw new BadRequestException('User has already been invited');
    }

    workspace.pendingInvitations.push({ email, role, invitedAt: new Date() });
    const saved = await workspace.save();

    await this.auditLogsService.createLog(
      'member_invited',
      `User ${email} invited as ${role}`,
      { workspaceId },
    );

    // Send email
    try {
      const appUrl =
        this.configService.get<string>('APP_URL') || 'http://localhost:3000';
      const inviteUrl = `${appUrl}/invitations/${workspace._id.toString()}`;
      await this.mailerService.sendMail({
        to: email,
        subject: `You've been invited to join ${workspace.name} on AutoSocial`,
        html: `
          <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #0f172a; margin-top: 0;">Invitation to join ${workspace.name}</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.5;">
              Hello,
            </p>
            <p style="color: #475569; font-size: 16px; line-height: 1.5;">
              You have been invited to collaborate in the workspace <strong>${workspace.name}</strong> as an <strong>${role}</strong>.
            </p>
            <p style="color: #475569; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
              AutoSocial helps teams plan, schedule, and automate their social media content seamlessly.
            </p>
            <a href="${inviteUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
              View Invitation
            </a>
            <p style="color: #64748b; font-size: 14px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
              If you don't have an account yet, you'll be prompted to create one first.<br/>
              Or you can copy and paste this link into your browser: <br/>
              <a href="${inviteUrl}" style="color: #2563eb;">${inviteUrl}</a>
            </p>
          </div>
        `,
      });
    } catch (e) {
      console.error('Failed to send invitation email:', e);
      // We don't fail the request if email fails, but in production we might want to log it to an error tracking system
    }

    return saved;
  }

  async revokeInvitation(
    workspaceId: string,
    email: string,
  ): Promise<Workspace> {
    const workspace = await this.workspaceModel.findById(workspaceId);
    if (!workspace) throw new NotFoundException('Workspace not found');

    const inviteIndex = workspace.pendingInvitations.findIndex(
      (inv) => inv.email === email,
    );
    if (inviteIndex === -1) {
      throw new NotFoundException('Invitation not found');
    }

    workspace.pendingInvitations.splice(inviteIndex, 1);
    const saved = await workspace.save();

    await this.auditLogsService.createLog(
      'invitation_revoked',
      `Invitation for ${email} revoked`,
      { workspaceId },
    );
    return saved;
  }

  async acceptInvitation(
    workspaceId: string,
    userId: string,
    email: string,
  ): Promise<Workspace> {
    const workspace = await this.workspaceModel.findById(workspaceId);
    if (!workspace) throw new NotFoundException('Workspace not found');

    const inviteIndex = workspace.pendingInvitations.findIndex(
      (inv) => inv.email === email,
    );
    if (inviteIndex === -1) {
      throw new NotFoundException('Invitation not found or already processed');
    }

    const role = workspace.pendingInvitations[inviteIndex].role;
    workspace.pendingInvitations.splice(inviteIndex, 1);

    // Check if already member
    if (!workspace.members.some((m) => m.userId.toString() === userId)) {
      workspace.members.push({ userId: new Types.ObjectId(userId), role });
    }

    const saved = await workspace.save();
    await this.auditLogsService.createLog(
      'member_joined',
      `User ${email} accepted invitation and joined as ${role}`,
      { workspaceId },
    );
    return saved;
  }

  async rejectInvitation(
    workspaceId: string,
    email: string,
  ): Promise<Workspace> {
    return this.revokeInvitation(workspaceId, email); // Logic is the same, just remove from pending array
  }

  async leaveWorkspace(workspaceId: string, userId: string): Promise<void> {
    const workspace = await this.workspaceModel.findById(workspaceId);
    if (!workspace) throw new NotFoundException('Workspace not found');

    const memberIndex = workspace.members.findIndex(
      (m) => m.userId.toString() === userId,
    );
    if (memberIndex === -1) {
      throw new NotFoundException('User is not a member of this workspace');
    }

    const member = workspace.members[memberIndex];
    if (member.role === WorkspaceRole.OWNER) {
      throw new BadRequestException(
        'Owners cannot leave the workspace. You must transfer ownership first or delete the workspace.',
      );
    }

    workspace.members.splice(memberIndex, 1);
    await workspace.save();

    const user = await this.usersService.findById(userId);
    const email = user ? user.email : userId;

    await this.auditLogsService.createLog(
      'member_left',
      `User ${email} left the workspace`,
      { workspaceId },
    );
  }

  async removeMember(workspaceId: string, userId: string): Promise<Workspace> {
    const workspace = await this.workspaceModel.findById(workspaceId);
    if (!workspace) throw new NotFoundException('Workspace not found');

    const memberIndex = workspace.members.findIndex(
      (m) => m.userId.toString() === userId,
    );
    if (memberIndex === -1) {
      throw new NotFoundException('User is not a member of this workspace');
    }

    // Prevent removing the last owner
    const owners = workspace.members.filter(
      (m) => m.role === WorkspaceRole.OWNER,
    );
    if (
      owners.length === 1 &&
      workspace.members[memberIndex].role === WorkspaceRole.OWNER
    ) {
      throw new BadRequestException(
        'Cannot remove the last owner of the workspace',
      );
    }

    workspace.members.splice(memberIndex, 1);
    const saved = await workspace.save();

    await this.auditLogsService.createLog(
      'member_removed',
      `User ID ${userId} removed`,
      { workspaceId },
    );
    return saved;
  }

  async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<Workspace> {
    const workspace = await this.workspaceModel.findById(workspaceId);
    if (!workspace) throw new NotFoundException('Workspace not found');

    const memberIndex = workspace.members.findIndex(
      (m) => m.userId.toString() === userId,
    );
    if (memberIndex === -1) {
      throw new NotFoundException('User is not a member of this workspace');
    }

    // Prevent downgrading the last owner
    const owners = workspace.members.filter(
      (m) => m.role === WorkspaceRole.OWNER,
    );
    if (
      owners.length === 1 &&
      workspace.members[memberIndex].role === WorkspaceRole.OWNER &&
      role !== WorkspaceRole.OWNER
    ) {
      throw new BadRequestException(
        'Cannot downgrade the last owner of the workspace',
      );
    }

    workspace.members[memberIndex].role = role;
    const saved = await workspace.save();

    await this.auditLogsService.createLog(
      'member_role_updated',
      `User ID ${userId} role changed to ${role}`,
      { workspaceId },
    );
    return saved;
  }

  async mockOauthConnect(workspaceId: string) {
    const workspace = await this.workspaceModel.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Simulate connecting to a provider
    const mockToken = `mock_oauth_token_${Math.random().toString(36).substring(7)}`;
    const encryptedToken = this.encryptionService.encrypt(mockToken);

    workspace.connectedAccounts.push({
      provider: 'MockSocial',
      accessToken: encryptedToken,
    });
    await workspace.save();

    // Log OAuth connection
    await this.auditLogsService.createLog(
      'oauth_connected',
      `Workspace connected to Mock Social Provider`,
      { workspaceId },
    );

    return {
      message: 'Successfully connected to Mock Social Provider',
      provider: 'MockSocial',
      token: mockToken,
    };
  }

  async generateRedditAuthLink(workspaceId: string) {
    const workspace = await this.workspaceModel.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const clientId = this.configService.get<string>('REDDIT_CLIENT_ID');
    const callbackUrl =
      this.configService.get<string>('REDDIT_CALLBACK_URL') ||
      'http://localhost:5000/workspaces/reddit/callback';

    if (!clientId) {
      throw new BadRequestException(
        'Reddit OAuth credentials are not configured in the environment.',
      );
    }

    // Generate a random state
    const state = Math.random().toString(36).substring(2, 15);

    // Store the workspaceId against the state in Redis for 10 minutes
    await this.redisClient.setex(
      `reddit_oauth_state:${state}`,
      600,
      JSON.stringify({ workspaceId }),
    );

    const scopes = 'submit identity';
    const url = `https://www.reddit.com/api/v1/authorize?client_id=${clientId}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(callbackUrl)}&duration=permanent&scope=${encodeURIComponent(scopes)}`;

    return { url };
  }

  async handleRedditCallback(state: string, code: string) {
    const sessionDataStr = await this.redisClient.get(
      `reddit_oauth_state:${state}`,
    );
    if (!sessionDataStr) {
      throw new BadRequestException('Invalid or expired OAuth state.');
    }

    const { workspaceId } = JSON.parse(sessionDataStr);
    await this.redisClient.del(`reddit_oauth_state:${state}`);

    const clientId = this.configService.get<string>('REDDIT_CLIENT_ID');
    const clientSecret = this.configService.get<string>('REDDIT_CLIENT_SECRET');
    const callbackUrl =
      this.configService.get<string>('REDDIT_CALLBACK_URL') ||
      'http://localhost:5000/workspaces/reddit/callback';

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Reddit credentials missing');
    }

    try {
      // Exchange code for token
      const authHeader =
        'Basic ' +
        Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const tokenResponse = await fetch(
        'https://www.reddit.com/api/v1/access_token',
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'SocialContentScheduler/1.0.0',
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: callbackUrl,
          }),
        },
      );

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Failed to get token: ${errorText}`);
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;

      // Get user identity to find the username
      const meResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'SocialContentScheduler/1.0.0',
        },
      });
      const meData = await meResponse.json();
      const username = meData.name;

      const workspace = await this.workspaceModel.findById(workspaceId);
      if (!workspace) throw new NotFoundException('Workspace not found');

      // Remove existing reddit account if any
      workspace.connectedAccounts = workspace.connectedAccounts.filter(
        (acc) => acc.provider !== 'reddit',
      );

      // Add new reddit account. We store username in the token field for simplicity, or we could add a new schema field.
      // We will just store it in the refreshToken or alongside it if we had a field. Since our schema is simple,
      // let's put the username as a prefix or we'll just fetch it on the fly. Actually, let's store username inside refreshToken like `username::real_refresh_token` for simplicity without schema changes.

      const encryptedAccessToken = this.encryptionService.encrypt(accessToken);
      const encryptedRefreshToken = this.encryptionService.encrypt(
        `${username}::${refreshToken}`,
      );

      workspace.connectedAccounts.push({
        provider: 'reddit',
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
      });

      await workspace.save();

      await this.auditLogsService.createLog(
        'oauth_connected',
        `Workspace connected to Reddit (u/${username})`,
        { workspaceId },
      );

      return {
        message: `Reddit account (u/${username}) successfully connected!`,
      };
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to authenticate with Reddit: ${error.message}`,
      );
    }
  }
}
