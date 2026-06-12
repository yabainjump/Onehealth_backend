import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { PublicUser } from '../users/interfaces/public-user.interface';
import { AddCommentDto } from './dto/add-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsDto } from './dto/list-posts.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Post, PostDocument } from './schemas/post.schema';
import { NotificationsService } from '../notifications/notifications.service';

type CommentLookupContext = {
  text?: string;
  authorId?: string;
  createdAt?: string;
};

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<Post>,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Notifie l'auteur d'une publication (j'aime / commentaire), jamais soi-même. */
  private async notifyPostAuthor(
    post: PostDocument,
    actorId: string,
    type: 'like' | 'comment',
  ): Promise<void> {
    try {
      const recipientId = post.authorId.toString();
      if (recipientId === actorId) {
        return;
      }
      const actor = await this.usersService.findById(actorId);
      const actorName = actor
        ? `${actor.firstName || ''} ${actor.lastName || ''}`.trim() ||
          actor.username ||
          ''
        : '';
      await this.notificationsService.create({
        recipientId,
        actorId,
        actorName,
        actorPhotoURL: actor?.photoURL || '',
        type,
        postId: post._id.toString(),
      });
    } catch {
      // Une notification qui échoue ne doit jamais casser l'action principale.
    }
  }

  async create(authorId: string, dto: CreatePostDto) {
    const content = `${dto.content || ''}`.trim();
    const imageUrls = dto.imageUrls ?? [];
    const attachment = dto.attachment ?? null;
    if (!content && imageUrls.length === 0 && !attachment) {
      throw new BadRequestException(
        'A post must contain text, images, or one attachment.',
      );
    }

    const post = new this.postModel({
      authorId: new Types.ObjectId(authorId),
      title: dto.title?.trim() ?? '',
      content,
      imageUrls,
      attachment,
      hashtags: this.extractHashtags(content),
    });

    const saved = await post.save();
    const usersMap = await this.buildUsersMap([saved]);
    return this.toPostResponse(saved, authorId, usersMap);
  }

  async list(currentUserId: string, query: ListPostsDto) {
    const limit = query.limit ?? 30;
    const page = query.page ?? 1;
    const skip = (page - 1) * limit;
    const filter = query.authorId
      ? { authorId: new Types.ObjectId(query.authorId) }
      : {};

    const posts = await this.postModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    await Promise.all(
      posts.map(async (post) => {
        if (this.normalizeComments(post)) {
          await post.save();
        }
      }),
    );

    const usersMap = await this.buildUsersMap(posts);
    return posts.map((post) =>
      this.toPostResponse(post, currentUserId, usersMap),
    );
  }

  async listByUser(
    userId: string,
    currentUserId: string,
    limit = 30,
    page = 1,
  ) {
    const skip = (page - 1) * limit;

    const posts = await this.postModel
      .find({ authorId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    await Promise.all(
      posts.map(async (post) => {
        if (this.normalizeComments(post)) {
          await post.save();
        }
      }),
    );

    const usersMap = await this.buildUsersMap(posts);
    return posts.map((post) =>
      this.toPostResponse(post, currentUserId, usersMap),
    );
  }

  async listByHashtag(
    tag: string,
    currentUserId: string,
    limit = 30,
    page = 1,
  ) {
    // On ne garde que des caractères de hashtag (anti-injection regex).
    const normalized = `${tag || ''}`
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_]/gu, '');
    if (!normalized) {
      return [];
    }

    const skip = (page - 1) * limit;
    // hashtags: posts récents (champ indexé) ; content: rétro-compat posts anciens
    // créés avant l'ajout du champ hashtags (recherche par regex sur le texte).
    const contentRegex = new RegExp(`#${normalized}(?![\\p{L}\\p{N}_])`, 'iu');
    const posts = await this.postModel
      .find({ $or: [{ hashtags: normalized }, { content: contentRegex }] })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    await Promise.all(
      posts.map(async (post) => {
        if (this.normalizeComments(post)) {
          await post.save();
        }
      }),
    );

    const usersMap = await this.buildUsersMap(posts);
    return posts.map((post) =>
      this.toPostResponse(post, currentUserId, usersMap),
    );
  }

  private extractHashtags(content: string): string[] {
    const text = `${content || ''}`;
    const regex = /(^|\s)#([\p{L}\p{N}_]{1,50})/gu;
    const tags = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      tags.add(match[2].toLowerCase());
    }
    return [...tags];
  }

  async findById(postId: string, currentUserId: string) {
    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (this.normalizeComments(post)) {
      await post.save();
    }
    const usersMap = await this.buildUsersMap([post]);
    return this.toPostResponse(post, currentUserId, usersMap);
  }

  async listComments(postId: string, currentUserId: string) {
    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (this.normalizeComments(post)) {
      await post.save();
    }
    const usersMap = await this.buildUsersMap([post]);
    const response = this.toPostResponse(post, currentUserId, usersMap);
    return response.comments;
  }

  async like(postId: string, currentUserId: string) {
    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (this.normalizeComments(post)) {
      await post.save();
    }

    const alreadyLiked = post.likedBy.some(
      (userId) => userId.toString() === currentUserId,
    );

    if (!alreadyLiked) {
      post.likedBy.push(new Types.ObjectId(currentUserId));
      post.likesCount += 1;
      await post.save();
      void this.notifyPostAuthor(post, currentUserId, 'like');
    }

    const usersMap = await this.buildUsersMap([post]);
    return this.toPostResponse(post, currentUserId, usersMap);
  }

  async unlike(postId: string, currentUserId: string) {
    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (this.normalizeComments(post)) {
      await post.save();
    }

    const beforeCount = post.likedBy.length;
    post.likedBy = post.likedBy.filter(
      (userId) => userId.toString() !== currentUserId,
    );

    if (post.likedBy.length !== beforeCount) {
      post.likesCount = Math.max(0, post.likesCount - 1);
      await post.save();
    }

    const usersMap = await this.buildUsersMap([post]);
    return this.toPostResponse(post, currentUserId, usersMap);
  }

  async addComment(postId: string, currentUserId: string, dto: AddCommentDto) {
    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    post.comments.push({
      commentId: new Types.ObjectId().toString(),
      authorId: new Types.ObjectId(currentUserId),
      text: dto.text.trim(),
      likesCount: 0,
      likedBy: [],
      createdAt: new Date(),
    });
    await post.save();
    void this.notifyPostAuthor(post, currentUserId, 'comment');

    const usersMap = await this.buildUsersMap([post]);
    return this.toPostResponse(post, currentUserId, usersMap);
  }

  async likeComment(
    postId: string,
    commentId: string,
    currentUserId: string,
    context?: CommentLookupContext,
  ) {
    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (this.normalizeComments(post)) {
      await post.save();
    }

    let comment = this.findCommentByAnyId(post, commentId);
    let shouldSave = false;
    if (!comment) {
      comment = this.findCommentByContext(post, context);
      if (comment && this.ensureCommentId(comment, commentId)) {
        shouldSave = true;
      }
    }
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (this.normalizeSingleComment(comment)) {
      shouldSave = true;
    }

    const alreadyLiked = (comment.likedBy || []).some(
      (userId: Types.ObjectId) => userId.toString() === currentUserId,
    );

    if (!alreadyLiked) {
      comment.likedBy = [...(comment.likedBy || []), new Types.ObjectId(currentUserId)];
      comment.likesCount = (comment.likesCount || 0) + 1;
      shouldSave = true;
    }

    if (shouldSave) {
      await post.save();
    }

    const usersMap = await this.buildUsersMap([post]);
    return this.toPostResponse(post, currentUserId, usersMap);
  }

  async unlikeComment(
    postId: string,
    commentId: string,
    currentUserId: string,
    context?: CommentLookupContext,
  ) {
    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (this.normalizeComments(post)) {
      await post.save();
    }

    let comment = this.findCommentByAnyId(post, commentId);
    let shouldSave = false;
    if (!comment) {
      comment = this.findCommentByContext(post, context);
      if (comment && this.ensureCommentId(comment, commentId)) {
        shouldSave = true;
      }
    }
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (this.normalizeSingleComment(comment)) {
      shouldSave = true;
    }

    const beforeCount = (comment.likedBy || []).length;
    comment.likedBy = (comment.likedBy || []).filter(
      (userId: Types.ObjectId) => userId.toString() !== currentUserId,
    );

    if ((comment.likedBy || []).length !== beforeCount) {
      comment.likesCount = Math.max(0, (comment.likesCount || 0) - 1);
      shouldSave = true;
    }

    if (shouldSave) {
      await post.save();
    }

    const usersMap = await this.buildUsersMap([post]);
    return this.toPostResponse(post, currentUserId, usersMap);
  }

  async update(postId: string, currentUserId: string, dto: UpdatePostDto) {
    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId.toString() !== currentUserId) {
      throw new ForbiddenException('You cannot update this post');
    }

    if (dto.title !== undefined) {
      post.title = dto.title.trim();
    }
    if (dto.content !== undefined) {
      post.content = dto.content.trim();
      post.hashtags = this.extractHashtags(post.content);
    }
    if (dto.imageUrls !== undefined) {
      post.imageUrls = dto.imageUrls;
    }
    if (dto.attachment !== undefined) {
      post.attachment = dto.attachment;
    }

    const hasText = `${post.content || ''}`.trim().length > 0;
    const hasImages = Array.isArray(post.imageUrls) && post.imageUrls.length > 0;
    const hasAttachment = !!post.attachment;
    if (!hasText && !hasImages && !hasAttachment) {
      throw new BadRequestException(
        'A post must contain text, images, or one attachment.',
      );
    }

    await post.save();
    const usersMap = await this.buildUsersMap([post]);
    return this.toPostResponse(post, currentUserId, usersMap);
  }

  async remove(postId: string, currentUserId: string) {
    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId.toString() !== currentUserId) {
      throw new ForbiddenException('You cannot delete this post');
    }

    await post.deleteOne();
    return { success: true };
  }

  private async buildUsersMap(posts: PostDocument[]): Promise<Map<string, PublicUser>> {
    const userIds = new Set<string>();

    for (const post of posts) {
      userIds.add(post.authorId.toString());
      for (const comment of post.comments || []) {
        userIds.add(comment.authorId.toString());
      }
    }

    const users = await this.usersService.findByIds(Array.from(userIds));
    const map = new Map<string, PublicUser>();
    for (const user of users) {
      map.set(user._id.toString(), this.usersService.toPublicUser(user));
    }

    return map;
  }

  private normalizeComments(post: PostDocument): boolean {
    let changed = false;

    for (const comment of post.comments || []) {
      if (this.normalizeSingleComment(comment)) {
        changed = true;
      }
    }

    return changed;
  }

  private findCommentByAnyId(post: PostDocument, commentId: string) {
    const target = this.normalizeCommentKey(commentId);
    return (post.comments || []).find((item: any) => {
      const normalizedCommentId = this.normalizeCommentKey(
        item?.commentId?.toString?.() ?? '',
      );
      const legacyMongoSubId = this.normalizeCommentKey(
        item?._id?.toString?.() ?? '',
      );
      const legacyIdField = this.normalizeCommentKey(item?.id?.toString?.() ?? '');
      return (
        normalizedCommentId === target ||
        legacyMongoSubId === target ||
        legacyIdField === target
      );
    }) as any;
  }

  private findCommentByContext(
    post: PostDocument,
    context?: CommentLookupContext,
  ) {
    if (!context) {
      return undefined;
    }

    const hasText = !!`${context.text || ''}`.trim();
    const hasAuthorId = !!`${context.authorId || ''}`.trim();
    const hasCreatedAt = !!`${context.createdAt || ''}`.trim();
    if (!hasText && !hasAuthorId && !hasCreatedAt) {
      return undefined;
    }

    const targetText = `${context.text || ''}`.trim();
    const targetAuthorId = this.normalizeCommentKey(context.authorId || '');
    const targetCreatedAtMs = hasCreatedAt
      ? new Date(context.createdAt as string).getTime()
      : Number.NaN;

    const matches = (post.comments || []).filter((item: any) => {
      if (hasText && `${item?.text || ''}`.trim() !== targetText) {
        return false;
      }

      const commentAuthorId = this.normalizeCommentKey(
        item?.authorId?.toString?.() ?? '',
      );
      if (hasAuthorId && commentAuthorId !== targetAuthorId) {
        return false;
      }

      if (!Number.isNaN(targetCreatedAtMs)) {
        const itemCreatedAtMs = new Date(item?.createdAt ?? 0).getTime();
        if (itemCreatedAtMs !== targetCreatedAtMs) {
          return false;
        }
      }

      return true;
    });

    return matches.length ? (matches[matches.length - 1] as any) : undefined;
  }

  private ensureCommentId(comment: any, preferredId?: string): boolean {
    const current = `${comment?.commentId || ''}`.trim();
    if (current) {
      return false;
    }

    const candidate = `${preferredId || ''}`.trim();
    comment.commentId = candidate || new Types.ObjectId().toString();
    return true;
  }

  private normalizeSingleComment(comment: any): boolean {
    let changed = false;

    if (this.ensureCommentId(comment)) {
      changed = true;
    }
    if (comment.likesCount === undefined || comment.likesCount === null) {
      comment.likesCount = 0;
      changed = true;
    }
    if (!Array.isArray(comment.likedBy)) {
      comment.likedBy = [];
      changed = true;
    }

    return changed;
  }

  private normalizeCommentKey(value: string) {
    return `${value || ''}`.trim().toLowerCase();
  }

  private toPostResponse(
    post: PostDocument,
    currentUserId: string,
    usersMap: Map<string, PublicUser>,
  ) {
    const comments = (post.comments || []).map((comment) => ({
      id: comment.commentId || (comment as any)?._id?.toString?.() || '',
      author: usersMap.get(comment.authorId.toString()) ?? null,
      text: comment.text,
      likesCount: comment.likesCount || 0,
      userHasLiked: (comment.likedBy || []).some(
        (userId) => userId.toString() === currentUserId,
      ),
      createdAt: comment.createdAt,
    }));

    return {
      id: post._id.toString(),
      author: usersMap.get(post.authorId.toString()) ?? null,
      title: post.title,
      content: post.content,
      imageUrls: post.imageUrls,
      attachment: post.attachment || null,
      likesCount: post.likesCount,
      userHasLiked: post.likedBy.some(
        (userId) => userId.toString() === currentUserId,
      ),
      comments,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}
