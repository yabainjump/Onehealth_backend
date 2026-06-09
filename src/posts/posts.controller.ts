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
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import type { RequestWithUser } from '../users/interfaces/request-with-user.interface';
import { AddCommentDto } from './dto/add-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsDto } from './dto/list-posts.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // ---- LECTURE : publique (auth optionnelle) ----

  @ApiOperation({ summary: 'Lister le fil de publications (paginé) — public' })
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  list(@Req() req: RequestWithUser, @Query() query: ListPostsDto) {
    return this.postsService.list(req.user?.id ?? '', query);
  }

  @ApiOperation({ summary: 'Lister les publications d\'un utilisateur — public' })
  @ApiParam({ name: 'userId', description: "Identifiant de l'auteur" })
  @UseGuards(OptionalJwtAuthGuard)
  @Get('user/:userId')
  listByUser(
    @Req() req: RequestWithUser,
    @Param('userId', ParseObjectIdPipe) userId: string,
    @Query() query: ListPostsDto,
  ) {
    return this.postsService.listByUser(
      userId,
      req.user?.id ?? '',
      query.limit,
      query.page,
    );
  }

  @ApiOperation({ summary: 'Récupérer une publication par son id — public' })
  @ApiParam({ name: 'postId', description: 'Identifiant de la publication' })
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':postId')
  findById(
    @Req() req: RequestWithUser,
    @Param('postId', ParseObjectIdPipe) postId: string,
  ) {
    return this.postsService.findById(postId, req.user?.id ?? '');
  }

  @ApiOperation({ summary: 'Lister les commentaires d\'une publication — public' })
  @ApiParam({ name: 'postId', description: 'Identifiant de la publication' })
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':postId/comments')
  listComments(
    @Req() req: RequestWithUser,
    @Param('postId', ParseObjectIdPipe) postId: string,
  ) {
    return this.postsService.listComments(postId, req.user?.id ?? '');
  }

  // ---- ECRITURE : connexion requise ----

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Créer une publication' })
  @UseGuards(JwtAuthGuard)
  @HttpPost()
  create(@Req() req: RequestWithUser, @Body() dto: CreatePostDto) {
    return this.postsService.create(req.user.id, dto);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Modifier une publication' })
  @ApiParam({ name: 'postId', description: 'Identifiant de la publication' })
  @UseGuards(JwtAuthGuard)
  @Patch(':postId')
  update(
    @Req() req: RequestWithUser,
    @Param('postId', ParseObjectIdPipe) postId: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(postId, req.user.id, dto);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Aimer une publication' })
  @ApiParam({ name: 'postId', description: 'Identifiant de la publication' })
  @UseGuards(JwtAuthGuard)
  @HttpPost(':postId/like')
  like(
    @Req() req: RequestWithUser,
    @Param('postId', ParseObjectIdPipe) postId: string,
  ) {
    return this.postsService.like(postId, req.user.id);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Retirer son like d\'une publication' })
  @ApiParam({ name: 'postId', description: 'Identifiant de la publication' })
  @UseGuards(JwtAuthGuard)
  @Delete(':postId/like')
  unlike(
    @Req() req: RequestWithUser,
    @Param('postId', ParseObjectIdPipe) postId: string,
  ) {
    return this.postsService.unlike(postId, req.user.id);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Commenter une publication' })
  @ApiParam({ name: 'postId', description: 'Identifiant de la publication' })
  @UseGuards(JwtAuthGuard)
  @HttpPost(':postId/comments')
  comment(
    @Req() req: RequestWithUser,
    @Param('postId', ParseObjectIdPipe) postId: string,
    @Body() dto: AddCommentDto,
  ) {
    return this.postsService.addComment(postId, req.user.id, dto);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Aimer un commentaire' })
  @ApiParam({ name: 'postId', description: 'Identifiant de la publication' })
  @ApiParam({ name: 'commentId', description: 'Identifiant du commentaire' })
  @UseGuards(JwtAuthGuard)
  @HttpPost(':postId/comments/:commentId/like')
  likeComment(
    @Req() req: RequestWithUser,
    @Param('postId', ParseObjectIdPipe) postId: string,
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

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Retirer son like d\'un commentaire' })
  @ApiParam({ name: 'postId', description: 'Identifiant de la publication' })
  @ApiParam({ name: 'commentId', description: 'Identifiant du commentaire' })
  @UseGuards(JwtAuthGuard)
  @Delete(':postId/comments/:commentId/like')
  unlikeComment(
    @Req() req: RequestWithUser,
    @Param('postId', ParseObjectIdPipe) postId: string,
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

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Supprimer une publication' })
  @ApiParam({ name: 'postId', description: 'Identifiant de la publication' })
  @UseGuards(JwtAuthGuard)
  @Delete(':postId')
  remove(
    @Req() req: RequestWithUser,
    @Param('postId', ParseObjectIdPipe) postId: string,
  ) {
    return this.postsService.remove(postId, req.user.id);
  }
}
