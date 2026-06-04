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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestWithUser } from '../users/interfaces/request-with-user.interface';
import { AddCommentDto } from './dto/add-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsDto } from './dto/list-posts.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';

@ApiTags('Posts')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @ApiOperation({ summary: 'Créer une publication' })
  @HttpPost()
  create(@Req() req: RequestWithUser, @Body() dto: CreatePostDto) {
    return this.postsService.create(req.user.id, dto);
  }

  @ApiOperation({ summary: 'Lister le fil de publications (paginé)' })
  @Get()
  list(@Req() req: RequestWithUser, @Query() query: ListPostsDto) {
    return this.postsService.list(req.user.id, query);
  }

  @ApiOperation({ summary: 'Lister les publications d\'un utilisateur' })
  @ApiParam({ name: 'userId', description: "Identifiant de l'auteur" })
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

  @ApiOperation({ summary: 'Récupérer une publication par son id' })
  @ApiParam({ name: 'postId', description: 'Identifiant de la publication' })
  @Get(':postId')
  findById(@Req() req: RequestWithUser, @Param('postId') postId: string) {
    return this.postsService.findById(postId, req.user.id);
  }

  @ApiOperation({ summary: 'Lister les commentaires d\'une publication' })
  @ApiParam({ name: 'postId', description: 'Identifiant de la publication' })
  @Get(':postId/comments')
  listComments(@Req() req: RequestWithUser, @Param('postId') postId: string) {
    return this.postsService.listComments(postId, req.user.id);
  }

  @ApiOperation({ summary: 'Modifier une publication' })
  @ApiParam({ name: 'postId', description: 'Identifiant de la publication' })
  @Patch(':postId')
  update(
    @Req() req: RequestWithUser,
    @Param('postId') postId: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(postId, req.user.id, dto);
  }

  @ApiOperation({ summary: 'Aimer une publication' })
  @ApiParam({ name: 'postId', description: 'Identifiant de la publication' })
  @HttpPost(':postId/like')
  like(@Req() req: RequestWithUser, @Param('postId') postId: string) {
    return this.postsService.like(postId, req.user.id);
  }

  @ApiOperation({ summary: 'Retirer son like d\'une publication' })
  @ApiParam({ name: 'postId', description: 'Identifiant de la publication' })
  @Delete(':postId/like')
  unlike(@Req() req: RequestWithUser, @Param('postId') postId: string) {
    return this.postsService.unlike(postId, req.user.id);
  }

  @ApiOperation({ summary: 'Commenter une publication' })
  @ApiParam({ name: 'postId', description: 'Identifiant de la publication' })
  @HttpPost(':postId/comments')
  comment(
    @Req() req: RequestWithUser,
    @Param('postId') postId: string,
    @Body() dto: AddCommentDto,
  ) {
    return this.postsService.addComment(postId, req.user.id, dto);
  }

  @ApiOperation({ summary: 'Aimer un commentaire' })
  @ApiParam({ name: 'postId', description: 'Identifiant de la publication' })
  @ApiParam({ name: 'commentId', description: 'Identifiant du commentaire' })
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

  @ApiOperation({ summary: 'Retirer son like d\'un commentaire' })
  @ApiParam({ name: 'postId', description: 'Identifiant de la publication' })
  @ApiParam({ name: 'commentId', description: 'Identifiant du commentaire' })
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

  @ApiOperation({ summary: 'Supprimer une publication' })
  @ApiParam({ name: 'postId', description: 'Identifiant de la publication' })
  @Delete(':postId')
  remove(@Req() req: RequestWithUser, @Param('postId') postId: string) {
    return this.postsService.remove(postId, req.user.id);
  }
}
