import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from './posts.service';
import { getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { Post } from './schemas/post.schema';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('PostsService', () => {
  let service: PostsService;
  let postModel: any;
  let publishQueue: any;
  let auditLogsService: any;

  const validWorkspaceId = '507f1f77bcf86cd799439011';
  const mockPost = {
    _id: 'post123',
    title: 'Test Post',
    content: 'This is a test',
    workspaceId: validWorkspaceId,
    platforms: ['twitter'],
    status: 'draft',
    scheduledAt: null,
    save: jest.fn().mockResolvedValue(this),
  };

  class MockPostModel {
    constructor(public data: any) {
      Object.assign(this, data);
    }
    save = jest.fn().mockImplementation(() => Promise.resolve({ _id: 'post123', title: this.title || 'New Post', ...this }));
    
    static find = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([mockPost]) });
    static findById = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPost) });
    static findByIdAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPost) });
    static findByIdAndDelete = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPost) });
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        {
          provide: getModelToken(Post.name),
          useValue: MockPostModel,
        },
        {
          provide: getQueueToken('publish-post'),
          useValue: {
            add: jest.fn(),
            getJob: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: AuditLogsService,
          useValue: {
            createLog: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    postModel = module.get(getModelToken(Post.name));
    publishQueue = module.get(getQueueToken('publish-post'));
    auditLogsService = module.get(AuditLogsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new draft post and log audit', async () => {
      const dto = { title: 'New Post', content: 'hello', platforms: ['twitter'], workspaceId: validWorkspaceId };
      const user = { id: '507f191e810c19729de860ea', email: 'user@example.com' };
      
      const result = await service.create(user, dto as any);

      expect(result).toHaveProperty('_id', 'post123');
      expect(result.title).toBe('New Post');
      expect(auditLogsService.createLog).toHaveBeenCalledWith(
        'post_created',
        'Post "New Post" created by user@example.com',
        { postId: 'post123', workspaceId: validWorkspaceId }
      );
    });
  });

  describe('schedulePost', () => {
    it('should throw BadRequestException if scheduledAt is missing', async () => {
      // Mock findById to return a post without scheduledAt
      postModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockPost, scheduledAt: null })
      });

      await expect(service.schedulePost('post123')).rejects.toThrow(BadRequestException);
    });

    it('should update status to scheduled, log audit, and add to queue', async () => {
      const futureDate = new Date(Date.now() + 60000);
      postModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockPost, scheduledAt: futureDate, workspaceId: { toString: () => validWorkspaceId } })
      });
      publishQueue.getJob.mockResolvedValue(null);

      await service.schedulePost('post123', { email: 'admin@test.com' });

      expect(postModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'post123',
        { status: 'scheduled' }
      );
      expect(auditLogsService.createLog).toHaveBeenCalledWith(
        'post_scheduled',
        expect.stringContaining('scheduled for publication at'),
        { postId: 'post123', workspaceId: validWorkspaceId }
      );
      expect(publishQueue.add).toHaveBeenCalledWith(
        'publish',
        { postId: 'post123' },
        expect.objectContaining({
          jobId: 'post-post123',
          delay: expect.any(Number),
        })
      );
    });
  });

  describe('publishNow', () => {
    it('should throw NotFound if post not found', async () => {
      postModel.findById = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.publishNow('missing_id')).rejects.toThrow(NotFoundException);
    });

    it('should add to queue with 0 delay and update status to publishing', async () => {
      postModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockPost, workspaceId: { toString: () => validWorkspaceId } })
      });
      publishQueue.getJob.mockResolvedValue(null);

      await service.publishNow('post123', { email: 'admin@test.com' });

      expect(postModel.findByIdAndUpdate).toHaveBeenCalledWith('post123', {
        $unset: { scheduledAt: 1, errorReason: 1 },
        $set: { status: 'scheduled' },
      });
      expect(publishQueue.add).toHaveBeenCalledWith(
        'publish',
        { postId: 'post123' },
        expect.objectContaining({ jobId: 'post-post123', delay: 0 })
      );
      expect(auditLogsService.createLog).toHaveBeenCalledWith(
        'post_publish_now',
        'Post "Test Post" submitted for immediate publication by admin@test.com',
        { postId: 'post123', workspaceId: validWorkspaceId }
      );
    });
  });
});
