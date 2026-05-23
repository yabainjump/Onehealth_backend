import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post as HttpPost,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestWithUser } from '../users/interfaces/request-with-user.interface';
import { AddCommentDto } from './dto/add-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsDto } from './dto/list-posts.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';

@UseGuards(JwtAuthGuard)
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @HttpPost()
  create(@Req() req: RequestWithUser, @Body() dto: CreatePostDto) {
    return this.postsService.create(req.user.id, dto);
  }

  @Get()
  list(@Req() req: RequestWithUser, @Query() query: ListPostsDto) {
    return this.postsService.list(req.user.id, query);
  }

  @Get('user/:userId')
  listByUser(
    @Req() req: RequestWithUser,
    @Param('userId') userId: string,
    @Query() query: ListPostsDto,
  ) {
    return this.postsService.listByUser(
      userId,
      req.user.id,
      query.limit,
      query.page,
    );
  }

  @Get(':postId')
  findById(@Req() req: RequestWithUser, @Param('postId') postId: string) {
    return this.postsService.findById(postId, req.user.id);
  }

  @Get(':postId/comments')
  listComments(@Req() req: RequestWithUser, @Param('postId') postId: string) {
    return this.postsService.listComments(postId, req.user.id);
  }

  @Patch(':postId')
  update(
    @Req() req: RequestWithUser,
    @Param('postId') postId: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(postId, req.user.id, dto);
  }

  @HttpPost(':postId/like')
  like(@Req() req: RequestWithUser, @Param('postId') postId: string) {
    return this.postsService.like(postId, req.user.id);
  }

  @Delete(':postId/like')
  unlike(@Req() req: RequestWithUser, @Param('postId') postId: string) {
    return this.postsService.unlike(postId, req.user.id);
  }

  @HttpPost(':postId/comments')
  comment(
    @Req() req: RequestWithUser,
    @Param('postId') postId: string,
    @Body() dto: AddCommentDto,
  ) {
    return this.postsService.addComment(postId, req.user.id, dto);
  }

  @HttpPost(':postId/comments/:commentId/like')
  likeComment(
    @Req() req: RequestWithUser,
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @Body()
    context?: {
      text?: string;
      authorId?: string;
      createdAt?: string;
    },
  ) {
    return this.postsService.likeComment(postId, commentId, req.user.id, context);
  }

  @Delete(':postId/comments/:commentId/like')
  unlikeComment(
    @Req() req: RequestWithUser,
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @Body()
    context?: {
      text?: string;
      authorId?: string;
      createdAt?: string;
    },
  ) {
    return this.postsService.unlikeComment(postId, commentId, req.user.id, context);
  }

  @Delete(':postId')
  remove(@Req() req: RequestWithUser, @Param('postId') postId: string) {
    return this.postsService.remove(postId, req.user.id);
  }
}
