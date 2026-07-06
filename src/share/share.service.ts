import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostAttachment } from '../posts/schemas/post.schema';
import { User } from '../users/schemas/user.schema';
import {
  SharePageMetadata,
  normalizeText,
  toAbsoluteUrl,
  truncateText,
} from './share-metadata.util';

@Injectable()
export class ShareService {
  private static readonly SHARE_VERSION = '5';
  private static readonly DEFAULT_SITE_NAME = 'One Health Network';
  private static readonly DEFAULT_SITE_DESCRIPTION =
    'One Health Network connecte les experts de la santé humaine, animale et environnementale. Lancez et suivez des alertes sanitaires en temps réel sur la carte interactive, prévenez les zoonoses et coordonnez la réponse aux crises : profils vérifiés, messagerie et assistant Rudolf AI.';
  private static readonly DEFAULT_LOCALE = 'fr_FR';
  private static readonly DEFAULT_FRONTEND_URL = 'http://localhost:8100';
  private static readonly DEFAULT_IMAGE_PATH = '/public/onehealth-share.png';

  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<Post>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly configService: ConfigService,
  ) {}

  getSiteShareMetadata(): SharePageMetadata {
    const siteName = this.resolveSiteName();
    const frontendBaseUrl = this.resolveFrontendBaseUrl();
    const apiBaseUrl = this.resolveApiBaseUrl();
    const defaultImage = this.resolveDefaultShareImage(apiBaseUrl);
    const siteDescription = this.resolveSiteDescription();
    const welcomeUrl = this.buildAbsoluteUrl(frontendBaseUrl, '/welcome');

    return {
      title: siteName,
      description: siteDescription,
      canonicalUrl: welcomeUrl,
      // og:url = URL du FRONTEND : c'est elle que les reseaux sociaux
      // affichent et utilisent comme lien canonique du partage.
      ogUrl: welcomeUrl,
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
      `/posts/${encodeURIComponent(postId)}`,
    );
    const socialUrl = `${canonicalUrl}?v=${ShareService.SHARE_VERSION}`;
    const defaultImage = this.resolveDefaultShareImage(apiBaseUrl);
    const imageUrl = this.resolvePostImageUrl(
      post.imageUrls || [],
      post.attachment,
      apiBaseUrl,
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
      ogUrl: socialUrl,
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
    const socialUrl = `${canonicalUrl}?v=${ShareService.SHARE_VERSION}`;
    const defaultImage = this.resolveDefaultShareImage(apiBaseUrl);
    // og:image = photo de profil convertie en JPEG (compatible robots sociaux),
    // sinon image de marque par defaut.
    const imageUrl =
      this.toSocialImageUrl((user.photoURL || '').trim(), apiBaseUrl) ?? defaultImage;
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
      ogUrl: socialUrl,
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

  /**
   * Sitemap dynamique : URLs FRONTEND des publications et profils publics.
   * Référencé depuis le robots.txt du frontend, il permet à Google d'indexer
   * le contenu (les pages statiques restent dans le sitemap.xml du frontend).
   */
  async getSitemapXml(): Promise<string> {
    const frontendBaseUrl = this.resolveFrontendBaseUrl();

    type SitemapDoc = { _id: unknown; updatedAt?: Date; createdAt?: Date };
    const [posts, users] = await Promise.all([
      this.postModel
        .find({ isHidden: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(1000)
        .select('_id updatedAt createdAt')
        .lean<SitemapDoc[]>()
        .exec(),
      this.userModel
        .find({ isBanned: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(1000)
        .select('_id updatedAt createdAt')
        .lean<SitemapDoc[]>()
        .exec(),
    ]);

    const entries: string[] = [];
    for (const post of posts) {
      entries.push(
        this.buildSitemapEntry(
          this.buildAbsoluteUrl(frontendBaseUrl, `/posts/${post._id}`),
          post.updatedAt ?? post.createdAt,
          'weekly',
          '0.8',
        ),
      );
    }
    for (const user of users) {
      entries.push(
        this.buildSitemapEntry(
          this.buildAbsoluteUrl(frontendBaseUrl, `/profils/${user._id}`),
          user.updatedAt ?? user.createdAt,
          'weekly',
          '0.6',
        ),
      );
    }

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...entries,
      '</urlset>',
    ].join('\n');
  }

  private buildSitemapEntry(
    loc: string,
    lastModified: Date | undefined,
    changefreq: string,
    priority: string,
  ): string {
    // Les URLs contiennent « ? » et « = » (valides en XML) mais jamais « & »
    // (un seul paramètre) ; on échappe quand même par sécurité.
    const safeLoc = loc.replace(/&/g, '&amp;');
    const lastmod = lastModified
      ? `\n    <lastmod>${new Date(lastModified).toISOString()}</lastmod>`
      : '';
    return `  <url>\n    <loc>${safeLoc}</loc>${lastmod}\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  }

  private resolvePostImageUrl(
    imageUrls: string[],
    attachment: PostAttachment | null | undefined,
    apiBaseUrl: string,
    fallbackImage: string,
  ): string {
    const firstImage = (imageUrls || []).find((value) => `${value || ''}`.trim().length > 0);
    if (firstImage) {
      return this.toSocialImageUrl(firstImage, apiBaseUrl) ?? fallbackImage;
    }

    // Pas d'image mais une video : on pointe og:image vers le poster genere a la
    // volee par /api/media/poster (extrait une image de la video, avec cache).
    const posterUrl = this.resolveVideoPosterUrl(attachment, apiBaseUrl);
    if (posterUrl) {
      return posterUrl;
    }

    return fallbackImage;
  }

  private resolveVideoPosterUrl(
    attachment: PostAttachment | null | undefined,
    apiBaseUrl: string,
  ): string | null {
    if (!attachment || attachment.type !== 'video') {
      return null;
    }

    const url = `${attachment.url || ''}`.trim();
    const uploadsIndex = url.indexOf('/uploads/');
    if (uploadsIndex === -1) {
      return null;
    }

    const uploadsPath = url.substring(uploadsIndex);
    const base = apiBaseUrl.replace(/\/+$/, '');
    return `${base}/api/media/poster?path=${encodeURIComponent(uploadsPath)}`;
  }

  // Construit l'URL d'apercu social (JPEG) d'une image stockee. Les photos et
  // images de posts sont souvent en WebP — format que les robots WhatsApp /
  // Facebook / LinkedIn n'affichent pas en og:image. On passe donc par
  // /api/media/social qui renvoie un JPEG (redimensionne, mis en cache).
  // Les URLs externes (http/https, ex: avatar Google) sont utilisees telles quelles.
  private toSocialImageUrl(rawUrl: string, apiBaseUrl: string): string | null {
    const value = `${rawUrl || ''}`.trim();
    if (!value) {
      return null;
    }

    const uploadsIndex = value.indexOf('/uploads/');
    if (uploadsIndex !== -1) {
      const uploadsPath = value.substring(uploadsIndex);
      const base = apiBaseUrl.replace(/\/+$/, '');
      return `${base}/api/media/social?path=${encodeURIComponent(uploadsPath)}`;
    }

    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    return null;
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

  private resolveDefaultShareImage(apiBaseUrl: string): string {
    const configuredImage = this.readConfig(
      'DEFAULT_SHARE_IMAGE',
      'defaultShareImage',
    );
    // Image par defaut hebergee par le backend (/public) : toujours joignable.
    const fallback = this.buildAbsoluteUrl(
      apiBaseUrl,
      ShareService.DEFAULT_IMAGE_PATH,
    );

    return toAbsoluteUrl(configuredImage, apiBaseUrl, fallback);
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
