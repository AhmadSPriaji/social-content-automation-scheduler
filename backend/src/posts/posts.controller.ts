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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @UseGuards(JwtAuthGuard, WorkspaceRolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.EDITOR)
  @Post()
  async create(@Req() req: Request, @Body() createPostDto: CreatePostDto) {
    const user: any = req.user;
    return this.postsService.create(user.id, createPostDto);
  }

  @UseGuards(JwtAuthGuard, WorkspaceRolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.EDITOR, WorkspaceRole.VIEWER)
  @Get()
  async findAll(@Query('workspaceId') workspaceId: string) {
    if (!workspaceId) {
      throw new BadRequestException('workspaceId query parameter is required');
    }
    return this.postsService.findAllByWorkspace(workspaceId);
  }

  @UseGuards(JwtAuthGuard, PostOwnershipGuard)
  @Put(':id')
  async update(@Param('id') id: string, @Body() updatePostDto: UpdatePostDto) {
    return this.postsService.update(id, updatePostDto);
  }

  @UseGuards(JwtAuthGuard, PostOwnershipGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.postsService.delete(id);
    return { message: 'Post deleted successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const filename: string = path.parse(file.originalname).name.replace(/\s/g, '') + '-' + uuidv4();
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
