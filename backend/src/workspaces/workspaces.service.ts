import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Workspace, WorkspaceRole } from './schemas/workspace.schema';
import { UsersService } from '../users/users.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class WorkspacesService {
  private redisClient: Redis;

  constructor(
    @InjectModel(Workspace.name) private workspaceModel: Model<Workspace>,
    private usersService: UsersService,
    private auditLogsService: AuditLogsService,
    private configService: ConfigService,
  ) {
    this.redisClient = new Redis(this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379');
  }

  async findById(id: string): Promise<Workspace | null> {
    return this.workspaceModel.findById(id).exec();
  }

  async findAllForUser(userId: string): Promise<Workspace[]> {
    // Find workspaces where members array contains an object with this userId
    return this.workspaceModel.find({ 'members.userId': new Types.ObjectId(userId) }).exec();
  }

  async getAuditLogs(workspaceId: string) {
    return this.auditLogsService.getLogsForWorkspace(workspaceId);
  }

  async create(name: string, userId: string): Promise<Workspace> {
    const newWorkspace = new this.workspaceModel({
      name,
      members: [{ userId: new Types.ObjectId(userId), role: WorkspaceRole.OWNER }],
    });
    const saved = await newWorkspace.save();

    // Log creation
    await this.auditLogsService.createLog('workspace_created', `Workspace '${name}' created by user ${userId}`, { workspaceId: saved._id.toString() });

    return saved;
  }

  async addMember(workspaceId: string, email: string, role: WorkspaceRole): Promise<Workspace> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User with this email not found');
    }

    const workspace = await this.workspaceModel.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    const userId = user._id.toString();

    // Check if user is already a member
    const existingMember = workspace.members.find((m) => m.userId.toString() === userId);
    if (existingMember) {
      throw new ForbiddenException('User is already a member of this workspace');
    } else {
      workspace.members.push({ userId: new Types.ObjectId(userId), role });
    }

    const saved = await workspace.save();

    // Log member addition
    await this.auditLogsService.createLog('member_added', `User ${email} added as ${role}`, { workspaceId });

    return saved;
  }

  async mockOauthConnect(workspaceId: string) {
    const workspace = await this.workspaceModel.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Simulate connecting to a provider
    const mockToken = `mock_oauth_token_${Math.random().toString(36).substring(7)}`;
    
    // Log OAuth connection
    await this.auditLogsService.createLog('oauth_connected', `Workspace connected to Mock Social Provider`, { workspaceId });

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
    const callbackUrl = this.configService.get<string>('REDDIT_CALLBACK_URL') || 'http://localhost:5000/workspaces/reddit/callback';

    if (!clientId) {
      throw new BadRequestException('Reddit OAuth credentials are not configured in the environment.');
    }

    // Generate a random state
    const state = Math.random().toString(36).substring(2, 15);
    
    // Store the workspaceId against the state in Redis for 10 minutes
    await this.redisClient.setex(`reddit_oauth_state:${state}`, 600, JSON.stringify({ workspaceId }));

    const scopes = 'submit identity';
    const url = `https://www.reddit.com/api/v1/authorize?client_id=${clientId}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(callbackUrl)}&duration=permanent&scope=${encodeURIComponent(scopes)}`;

    return { url };
  }

  async handleRedditCallback(state: string, code: string) {
    const sessionDataStr = await this.redisClient.get(`reddit_oauth_state:${state}`);
    if (!sessionDataStr) {
      throw new BadRequestException('Invalid or expired OAuth state.');
    }

    const { workspaceId } = JSON.parse(sessionDataStr);
    await this.redisClient.del(`reddit_oauth_state:${state}`);

    const clientId = this.configService.get<string>('REDDIT_CLIENT_ID');
    const clientSecret = this.configService.get<string>('REDDIT_CLIENT_SECRET');
    const callbackUrl = this.configService.get<string>('REDDIT_CALLBACK_URL') || 'http://localhost:5000/workspaces/reddit/callback';

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Reddit credentials missing');
    }

    try {
      // Exchange code for token
      const authHeader = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'SocialContentScheduler/1.0.0',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: callbackUrl,
        }),
      });

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
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'SocialContentScheduler/1.0.0',
        }
      });
      const meData = await meResponse.json();
      const username = meData.name;

      const workspace = await this.workspaceModel.findById(workspaceId);
      if (!workspace) throw new NotFoundException('Workspace not found');

      // Remove existing reddit account if any
      workspace.connectedAccounts = workspace.connectedAccounts.filter(acc => acc.provider !== 'reddit');
      
      // Add new reddit account. We store username in the token field for simplicity, or we could add a new schema field.
      // We will just store it in the refreshToken or alongside it if we had a field. Since our schema is simple,
      // let's put the username as a prefix or we'll just fetch it on the fly. Actually, let's store username inside refreshToken like `username::real_refresh_token` for simplicity without schema changes.
      workspace.connectedAccounts.push({
        provider: 'reddit',
        accessToken,
        refreshToken: `${username}::${refreshToken}`, // Hack to store username without changing schema
      });

      await workspace.save();

      await this.auditLogsService.createLog('oauth_connected', `Workspace connected to Reddit (u/${username})`, { workspaceId });

      return { message: `Reddit account (u/${username}) successfully connected!` };
    } catch (error: any) {
      throw new BadRequestException(`Failed to authenticate with Reddit: ${error.message}`);
    }
  }
}
