import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

import { PostsService } from './posts.service';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceRolesGuard } from '../common/guards/workspace-roles.guard';
import { PostOwnershipGuard } from '../common/guards/post-ownership.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { WorkspaceRole } from '../workspaces/schemas/workspace.schema';
import { WebhookSignatureGuard } from '../common/guards/webhook-signature.guard';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @ApiOperation({ summary: 'Create a new post' })
  @ApiResponse({ status: 201, description: 'Post created successfully.' })
  @UseGuards(JwtAuthGuard, WorkspaceRolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.EDITOR)
  @Post()
  async create(@Req() req: Request, @Body() createPostDto: CreatePostDto) {
    const user: any = req.user;
    return this.postsService.create(user, createPostDto);
  }

  @ApiOperation({ summary: 'Subscribe to real-time post updates' })
  @Sse('events')
  sendEvents(): Observable<MessageEvent> {
    return this.postsService.postUpdates$.asObservable().pipe(
      map((payload) => ({
        data: payload,
      })),
    );
  }

  @ApiOperation({ summary: 'Get all posts for a workspace' })
  @ApiResponse({ status: 200, description: 'List of posts.' })
  @UseGuards(JwtAuthGuard, WorkspaceRolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.EDITOR, WorkspaceRole.VIEWER)
  @Get()
  async findAll(@Query('workspaceId') workspaceId: string) {
    if (!workspaceId) {
      throw new BadRequestException('workspaceId query parameter is required');
    }
    return this.postsService.findAllByWorkspace(workspaceId);
  }

  @ApiOperation({ summary: 'Get dead-letter posts (failed)' })
  @ApiResponse({ status: 200, description: 'List of dead-letter posts.' })
  @UseGuards(JwtAuthGuard, WorkspaceRolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.EDITOR, WorkspaceRole.VIEWER)
  @Get('dead-letters')
  async getDeadLetters(@Query('workspaceId') workspaceId: string) {
    if (!workspaceId) {
      throw new BadRequestException('workspaceId query parameter is required');
    }
    return this.postsService.getDeadLetters(workspaceId);
  }

  @ApiOperation({ summary: 'Get audit logs for a post' })
  @ApiResponse({ status: 200, description: 'List of audit logs for the post.' })
  @UseGuards(JwtAuthGuard, PostOwnershipGuard)
  @Get(':id/audit-logs')
  async getAuditLogs(@Param('id') id: string) {
    return this.postsService.getAuditLogs(id);
  }

  @ApiOperation({ summary: 'Update a post' })
  @ApiResponse({ status: 200, description: 'Post updated successfully.' })
  @UseGuards(JwtAuthGuard, PostOwnershipGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.EDITOR)
  @Put(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    const user: any = req.user;
    return this.postsService.update(id, updatePostDto, user);
  }

  @ApiOperation({ summary: 'Delete a post' })
  @ApiResponse({ status: 200, description: 'Post deleted successfully.' })
  @UseGuards(JwtAuthGuard, PostOwnershipGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.EDITOR)
  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const user: any = req.user;
    await this.postsService.delete(id, user);
    return { message: 'Post deleted successfully' };
  }

  @ApiOperation({ summary: 'Schedule a post for publication' })
  @ApiResponse({ status: 201, description: 'Post successfully scheduled.' })
  @UseGuards(JwtAuthGuard, PostOwnershipGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.EDITOR)
  @Post(':id/schedule')
  async schedulePost(@Req() req: Request, @Param('id') id: string) {
    const user: any = req.user;
    await this.postsService.schedulePost(id, user);
    return {
      message: 'Post successfully scheduled',
      status: 'scheduled',
    };
  }

  @ApiOperation({ summary: 'Cancel a scheduled post' })
  @ApiResponse({
    status: 200,
    description: 'Post schedule successfully cancelled.',
  })
  @UseGuards(JwtAuthGuard, PostOwnershipGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.EDITOR)
  @Post(':id/cancel-schedule')
  async cancelSchedule(@Req() req: Request, @Param('id') id: string) {
    const user: any = req.user;
    await this.postsService.cancelSchedule(id, user);
    return {
      message: 'Post schedule successfully cancelled',
      status: 'draft',
    };
  }

  @ApiOperation({ summary: 'Publish a post immediately' })
  @ApiResponse({
    status: 200,
    description: 'Post successfully queued for immediate publication.',
  })
  @UseGuards(JwtAuthGuard, PostOwnershipGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.EDITOR)
  @Post(':id/publish-now')
  async publishNow(@Req() req: Request, @Param('id') id: string) {
    const user: any = req.user;
    await this.postsService.publishNow(id, user);
    return {
      message: 'Post submitted for immediate publication',
      status: 'scheduled',
    };
  }

  @ApiOperation({ summary: 'Duplicate a post' })
  @ApiResponse({ status: 201, description: 'Post successfully duplicated.' })
  @UseGuards(JwtAuthGuard, PostOwnershipGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.EDITOR, WorkspaceRole.VIEWER)
  @Post(':id/duplicate')
  async duplicate(@Req() req: Request, @Param('id') id: string) {
    const user: any = req.user;
    const duplicatedPost = await this.postsService.duplicate(id, user.id);
    return {
      message: 'Post successfully duplicated',
      post: duplicatedPost,
    };
  }

  @ApiOperation({ summary: 'Generate AI Caption' })
  @ApiResponse({ status: 201, description: 'Generated caption returned.' })
  @UseGuards(JwtAuthGuard)
  @Post('generate-caption')
  async generateAiCaption(@Body() body: { prompt: string }) {
    if (!body.prompt) {
      throw new BadRequestException('prompt is required in the body');
    }
    return this.postsService.generateAiCaption(body.prompt);
  }

  @ApiOperation({ summary: 'Simulate Webhook Callback' })
  @ApiResponse({ status: 200, description: 'Webhook processed.' })
  @UseGuards(WebhookSignatureGuard)
  @Post(':id/webhook')
  async webhookCallback(
    @Param('id') id: string,
    @Body() payload: { event: string; details: string },
  ) {
    return this.postsService.handleWebhook(id, payload);
  }

  @ApiOperation({ summary: 'Get Mock Analytics' })
  @ApiResponse({ status: 200, description: 'Returns random mock analytics.' })
  @UseGuards(JwtAuthGuard, PostOwnershipGuard)
  @Get(':id/analytics')
  async getAnalytics(@Param('id') id: string) {
    return this.postsService.getMockAnalytics(id);
  }

  @ApiOperation({ summary: 'Upload a file' })
  @ApiResponse({ status: 201, description: 'File uploaded successfully.' })
  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const filename: string =
            path.parse(file.originalname).name.replace(/\s/g, '') +
            '-' +
            uuidv4();
          const extension: string = path.parse(file.originalname).ext;
          cb(null, `${filename}${extension}`);
        },
      }),
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    // Return relative URL for the uploaded file
    return {
      url: `/uploads/${file.filename}`,
      filename: file.filename,
    };
  }
}
