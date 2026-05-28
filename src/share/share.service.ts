import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post } from '../posts/schemas/post.schema';
import { User } from '../users/schemas/user.schema';
import {
  SharePageMetadata,
  normalizeText,
  toAbsoluteUrl,
  truncateText,
} from './share-metadata.util';

@Injectable()
export class ShareService {
  private static readonly DEFAULT_SITE_NAME = 'One Health Network';
  private static readonly DEFAULT_SITE_DESCRIPTION =
    'A global collaboration network for human, animal, and environmental health.';
  private static readonly DEFAULT_LOCALE = 'fr_FR';
  private static readonly DEFAULT_FRONTEND_URL = 'http://localhost:8100';
  private static readonly DEFAULT_IMAGE_PATH =
    '/assets/images/logo-onehealth-in-cameroon.png';

  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<Post>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly configService: ConfigService,
  ) {}

  getSiteShareMetadata(): SharePageMetadata {
    const siteName = this.resolveSiteName();
    const frontendBaseUrl = this.resolveFrontendBaseUrl();
    const apiBaseUrl = this.resolveApiBaseUrl();
    const defaultImage = this.resolveDefaultShareImage(frontendBaseUrl);
    const siteDescription = this.resolveSiteDescription();
    const welcomeUrl = this.buildAbsoluteUrl(frontendBaseUrl, '/welcome');
    const shareUrl = this.buildAbsoluteUrl(apiBaseUrl, '/api/share');

    return {
      title: siteName,
      description: siteDescription,
      canonicalUrl: welcomeUrl,
      ogUrl: shareUrl,
      ogType: 'website',
      imageUrl: defaultImage,
      siteName,
      locale: ShareService.DEFAULT_LOCALE,
      twitterCard: 'summary_large_image',
      twitterSite: this.resolveTwitterHandle(),
      appName: siteName,
      redirectUrl: welcomeUrl,
    };
  }

  async getPostShareMetadata(postId: string): Promise<SharePageMetadata> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new NotFoundException('Post not found');
    }

    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const author = await this.userModel.findById(post.authorId).exec();
    const siteName = this.resolveSiteName();
    const frontendBaseUrl = this.resolveFrontendBaseUrl();
    const apiBaseUrl = this.resolveApiBaseUrl();
    const canonicalUrl = this.buildAbsoluteUrl(
      frontendBaseUrl,
      `/post-detail?id=${encodeURIComponent(postId)}`,
    );
    const shareUrl = this.buildAbsoluteUrl(
      apiBaseUrl,
      `/api/share/post/${encodeURIComponent(postId)}`,
    );
    const defaultImage = this.resolveDefaultShareImage(frontendBaseUrl);
    const imageUrl = this.resolvePostImageUrl(
      post.imageUrls || [],
      frontendBaseUrl,
      defaultImage,
    );
    const authorName = this.resolveAuthorName(author);
    const titleFromPost = normalizeText(post.title || '');
    const contentPreview = truncateText(normalizeText(post.content || ''), 120);
    const title = truncateText(
      titleFromPost || contentPreview || `${authorName} on ${siteName}`,
      70,
    );
    const description = truncateText(
      normalizeText(post.content || post.title || '') ||
        `${authorName} shared a publication on ${siteName}.`,
      220,
    );

    return {
      title,
      description,
      canonicalUrl,
      ogUrl: shareUrl,
      ogType: 'article',
      imageUrl,
      siteName,
      locale: ShareService.DEFAULT_LOCALE,
      twitterCard: 'summary_large_image',
      twitterSite: this.resolveTwitterHandle(),
      appName: siteName,
      authorName,
      publishedTime: post.createdAt ? new Date(post.createdAt).toISOString() : undefined,
      redirectUrl: canonicalUrl,
    };
  }

  async getProfileShareMetadata(userId: string): Promise<SharePageMetadata> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('User not found');
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const siteName = this.resolveSiteName();
    const frontendBaseUrl = this.resolveFrontendBaseUrl();
    const apiBaseUrl = this.resolveApiBaseUrl();
    const canonicalUrl = this.buildAbsoluteUrl(
      frontendBaseUrl,
      `/profils/${encodeURIComponent(userId)}`,
    );
    const shareUrl = this.buildAbsoluteUrl(
      apiBaseUrl,
      `/api/share/profile/${encodeURIComponent(userId)}`,
    );
    const defaultImage = this.resolveDefaultShareImage(frontendBaseUrl);
    const imageUrl = toAbsoluteUrl(
      (user.photoURL || '').trim(),
      frontendBaseUrl,
      defaultImage,
    );
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    const displayName =
      normalizeText(fullName) || normalizeText(user.username || '') || 'User';
    const bio = truncateText(
      normalizeText(user.bio || '') ||
        `${displayName} is a member of ${siteName}.`,
      220,
    );
    const title = truncateText(`${displayName} • ${siteName}`, 70);

    return {
      title,
      description: bio,
      canonicalUrl,
      ogUrl: shareUrl,
      ogType: 'profile',
      imageUrl,
      siteName,
      locale: ShareService.DEFAULT_LOCALE,
      twitterCard: 'summary_large_image',
      twitterSite: this.resolveTwitterHandle(),
      appName: siteName,
      redirectUrl: canonicalUrl,
    };
  }

  private resolvePostImageUrl(
    imageUrls: string[],
    baseUrl: string,
    fallbackImage: string,
  ): string {
    const firstImage = (imageUrls || []).find((value) => `${value || ''}`.trim().length > 0);
    if (!firstImage) {
      return fallbackImage;
    }
    return toAbsoluteUrl(firstImage, baseUrl, fallbackImage);
  }

  private resolveAuthorName(author: User | null): string {
    if (!author) {
      return 'A One Health member';
    }

    const firstName = `${author.firstName || ''}`.trim();
    const lastName = `${author.lastName || ''}`.trim();
    const merged = `${firstName} ${lastName}`.trim();
    return merged || `${author.username || ''}`.trim() || 'A One Health member';
  }

  private resolveSiteName(): string {
    return (
      this.readConfig('SITE_NAME', 'siteName') || ShareService.DEFAULT_SITE_NAME
    );
  }

  private resolveSiteDescription(): string {
    return (
      this.readConfig('SITE_DEFAULT_DESCRIPTION', 'siteDefaultDescription') ||
      ShareService.DEFAULT_SITE_DESCRIPTION
    );
  }

  private resolveTwitterHandle(): string | undefined {
    const handle = this.readConfig('TWITTER_SITE_HANDLE', 'twitterSiteHandle');
    if (!handle) {
      return undefined;
    }

    return handle.startsWith('@') ? handle : `@${handle}`;
  }

  private resolveFrontendBaseUrl(): string {
    const explicitFrontendUrl = this.readConfig(
      'FRONTEND_PUBLIC_URL',
      'frontendPublicUrl',
    );
    if (explicitFrontendUrl) {
      return this.normalizeUrlBase(explicitFrontendUrl);
    }

    const corsOrigin = this.readConfig('CORS_ORIGIN', 'corsOrigin');
    const firstCorsOrigin = corsOrigin
      .split(',')
      .map((origin) => origin.trim())
      .find((origin) => origin.length > 0);
    if (firstCorsOrigin) {
      return this.normalizeUrlBase(firstCorsOrigin);
    }

    return ShareService.DEFAULT_FRONTEND_URL;
  }

  private resolveApiBaseUrl(): string {
    const explicitApiBase = this.readConfig('PUBLIC_BASE_URL', 'publicBaseUrl');
    if (explicitApiBase) {
      return this.normalizeUrlBase(explicitApiBase);
    }

    const port = this.configService.get<number>('PORT') ?? 3000;
    return `http://localhost:${port || 3000}`;
  }

  private resolveDefaultShareImage(frontendBaseUrl: string): string {
    const configuredImage = this.readConfig(
      'DEFAULT_SHARE_IMAGE',
      'defaultShareImage',
    );
    const fallback = this.buildAbsoluteUrl(
      frontendBaseUrl,
      ShareService.DEFAULT_IMAGE_PATH,
    );

    return toAbsoluteUrl(configuredImage, frontendBaseUrl, fallback);
  }

  private buildAbsoluteUrl(baseUrl: string, pathOrUrl: string): string {
    try {
      return new URL(pathOrUrl, `${baseUrl.replace(/\/+$/, '')}/`).toString();
    } catch {
      return pathOrUrl;
    }
  }

  private readConfig(primaryKey: string, secondaryKey: string): string {
    const primary = `${this.configService.get<string>(primaryKey) || ''}`.trim();
    if (primary) {
      return primary;
    }

    const secondary = `${this.configService.get<string>(secondaryKey) || ''}`.trim();
    if (secondary) {
      return secondary;
    }

    return '';
  }

  private normalizeUrlBase(value: string): string {
    return value.replace(/\/+$/, '');
  }
}
