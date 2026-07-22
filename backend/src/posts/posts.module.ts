import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { Post, PostSchema } from './schemas/post.schema';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { PostProcessor } from './post.processor';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Post.name, schema: PostSchema }]),
    BullModule.registerQueue({
      name: 'publish-post',
    }),
    WorkspacesModule,
    AuditLogsModule,
  ],
  controllers: [PostsController],
  providers: [PostsService, PostProcessor],
  exports: [PostsService],
})
export class PostsModule {}
