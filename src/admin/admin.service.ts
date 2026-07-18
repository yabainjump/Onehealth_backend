import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserRole } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { Post } from '../posts/schemas/post.schema';
import { Alert, AlertVerificationStatus } from '../alerts/schemas/alert.schema';
import { AlertsService } from '../alerts/alerts.service';
import {
  CertificationRequest,
  CertificationRequestDocument,
} from '../certifications/schemas/certification-request.schema';
import { CertificationsService } from '../certifications/certifications.service';

export interface ListAdminUsersQuery {
  search?: string;
  role?: string;
  status?: string; // all | banned | certified
  page?: number;
  limit?: number;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Post.name) private readonly postModel: Model<Post>,
    @InjectModel(Alert.name) private readonly alertModel: Model<Alert>,
    @InjectModel(CertificationRequest.name)
    private readonly requestModel: Model<CertificationRequest>,
    private readonly usersService: UsersService,
    private readonly certificationsService: CertificationsService,
    private readonly alertsService: AlertsService,
  ) {}

  /** KPIs de la vue d'ensemble du dashboard. */
  async getStats() {
    const [
      totalUsers,
      certifiedUsers,
      bannedUsers,
      pendingCertifications,
      totalPosts,
      totalAlerts,
    ] = await Promise.all([
      this.userModel.countDocuments().exec(),
      this.userModel.countDocuments({ isCertified: true }).exec(),
      this.userModel.countDocuments({ isBanned: true }).exec(),
      this.requestModel.countDocuments({ status: 'pending' }).exec(),
      this.postModel.countDocuments().exec(),
      this.alertModel.countDocuments().exec(),
    ]);
    return {
      totalUsers,
      certifiedUsers,
      bannedUsers,
      pendingCertifications,
      totalPosts,
      totalAlerts,
    };
  }

  /** Liste paginée des utilisateurs avec recherche et filtres. */
  async listUsers(query: ListAdminUsersQuery) {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const page = Math.max(query.page ?? 1, 1);

    const filter: Record<string, unknown> = {};
    const search = `${query.search ?? ''}`.trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [
        { username: regex },
        { email: regex },
        { firstName: regex },
        { lastName: regex },
      ];
    }
    if (query.role && ['user', 'admin'].includes(query.role)) {
      filter.role = query.role;
    }
    if (query.status === 'banned') {
      filter.isBanned = true;
    } else if (query.status === 'certified') {
      filter.isCertified = true;
    }

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    return {
      items: users.map((user) =>
        this.usersService.toPublicUser(user, user._id.toString()),
      ),
      total,
      page,
      limit,
    };
  }

  async updateUserRole(userId: string, role: UserRole, currentAdminId: string) {
    if (userId === currentAdminId && role !== UserRole.ADMIN) {
      throw new BadRequestException('You cannot remove your own admin role');
    }
    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: { role } }, { new: true })
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.usersService.toPublicUser(user, user._id.toString());
  }

  async setUserBanned(userId: string, banned: boolean, currentAdminId: string) {
    if (userId === currentAdminId) {
      throw new BadRequestException('You cannot suspend your own account');
    }
    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: { isBanned: banned } }, { new: true })
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.usersService.toPublicUser(user, user._id.toString());
  }

  /** Demandes de certification, filtrables par statut (pending par défaut). */
  async listCertificationRequests(status = 'pending', page = 1, limit = 20) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const filter: Record<string, unknown> = {};
    if (['pending', 'approved', 'rejected'].includes(status)) {
      filter.status = status;
    }

    const [requests, total] = await Promise.all([
      this.requestModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .exec(),
      this.requestModel.countDocuments(filter).exec(),
    ]);

    // Joint les infos publiques du demandeur pour l'affichage admin.
    const userIds = Array.from(
      new Set(requests.map((request) => request.userId.toString())),
    );
    const users = await this.usersService.findByIds(userIds);
    const usersById = new Map(
      users.map((user) => [
        user._id.toString(),
        this.usersService.toPublicUser(user, user._id.toString()),
      ]),
    );

    return {
      items: requests.map((request) => ({
        ...this.certificationsService.toResponse(request),
        user: usersById.get(request.userId.toString()) ?? null,
      })),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async approveCertification(requestId: string, adminId: string) {
    const request = await this.findPendingRequest(requestId);
    request.status = 'approved';
    request.reviewedBy = new Types.ObjectId(adminId);
    request.reviewedAt = new Date();
    await request.save();

    await this.userModel
      .updateOne(
        { _id: request.userId },
        { $set: { isCertified: true, certificationStatus: 'approved' } },
      )
      .exec();

    return this.certificationsService.toResponse(request);
  }

  async rejectCertification(
    requestId: string,
    adminId: string,
    reason: string,
  ) {
    const request = await this.findPendingRequest(requestId);
    request.status = 'rejected';
    request.adminNotes = reason.trim();
    request.reviewedBy = new Types.ObjectId(adminId);
    request.reviewedAt = new Date();
    await request.save();

    await this.userModel
      .updateOne(
        { _id: request.userId },
        { $set: { isCertified: false, certificationStatus: 'rejected' } },
      )
      .exec();

    return this.certificationsService.toResponse(request);
  }

  /** Modération : liste paginée des posts (recherche texte, masqués inclus). */
  async listPosts(search = '', page = 1, limit = 20) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const filter: Record<string, unknown> = {};
    const trimmed = `${search}`.trim();
    if (trimmed) {
      const regex = new RegExp(
        trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      );
      filter.$or = [{ content: regex }, { title: regex }];
    }

    const [posts, total] = await Promise.all([
      this.postModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .exec(),
      this.postModel.countDocuments(filter).exec(),
    ]);

    const authorsById = await this.buildAuthorsMap(
      posts.map((post) => post.authorId.toString()),
    );

    return {
      items: posts.map((post) => ({
        id: post._id.toString(),
        title: post.title,
        content: post.content,
        imageUrls: post.imageUrls || [],
        likesCount: post.likesCount || 0,
        commentsCount: (post.comments || []).length,
        isHidden: !!post.isHidden,
        createdAt: post.createdAt,
        author: authorsById.get(post.authorId.toString()) ?? null,
      })),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  /** Modération : liste paginée des alertes (recherche texte, masquées incluses). */
  async listAlerts(search = '', page = 1, limit = 20) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const filter: Record<string, unknown> = {};
    const trimmed = `${search}`.trim();
    if (trimmed) {
      const regex = new RegExp(
        trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      );
      filter.$or = [
        { title: regex },
        { description: regex },
        { country: regex },
        { city: regex },
      ];
    }

    const [alerts, total] = await Promise.all([
      this.alertModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .exec(),
      this.alertModel.countDocuments(filter).exec(),
    ]);

    const authorsById = await this.buildAuthorsMap(
      alerts.map((alert) => alert.authorId.toString()),
    );

    return {
      items: alerts.map((alert) => ({
        id: alert._id.toString(),
        category: alert.category,
        title: alert.title,
        description: alert.description,
        severity: alert.severity,
        country: alert.country,
        city: alert.city,
        imageUrls: alert.imageUrls || [],
        isHidden: !!alert.isHidden,
        verificationStatus: alert.verificationStatus ?? 'pending',
        reviewedAt: alert.reviewedAt ?? null,
        createdAt: alert.createdAt,
        author: authorsById.get(alert.authorId.toString()) ?? null,
      })),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  /** Met un post en pause (masqué des fils) ou le republie. */
  async setPostHidden(postId: string, hidden: boolean) {
    const post = await this.postModel
      .findByIdAndUpdate(postId, { $set: { isHidden: hidden } }, { new: true })
      .exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return { id: post._id.toString(), isHidden: !!post.isHidden };
  }

  /** Met une alerte en pause ou la republie. */
  async setAlertHidden(alertId: string, hidden: boolean) {
    const alert = await this.alertModel
      .findByIdAndUpdate(alertId, { $set: { isHidden: hidden } }, { new: true })
      .exec();
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    return { id: alert._id.toString(), isHidden: !!alert.isHidden };
  }

  /** Attribue un statut de confiance à une alerte et conserve la trace du relecteur. */
  async setAlertVerification(
    alertId: string,
    status: AlertVerificationStatus,
    reviewerId: string,
  ) {
    const previous = await this.alertModel.findById(alertId).exec();
    if (!previous) {
      throw new NotFoundException('Alert not found');
    }

    const updated = await this.alertModel
      .findByIdAndUpdate(
        alertId,
        {
          $set: {
            verificationStatus: status,
            reviewedAt: new Date(),
            reviewedBy: new Types.ObjectId(reviewerId),
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException('Alert not found');
    }

    if (
      status === 'verified' &&
      (previous.verificationStatus ?? 'pending') !== 'verified'
    ) {
      void this.alertsService
        .notifyVerifiedAlert(updated._id.toString())
        .catch(() => undefined);
    }

    return {
      id: updated._id.toString(),
      verificationStatus: updated.verificationStatus,
      reviewedAt: updated.reviewedAt,
    };
  }

  private async buildAuthorsMap(authorIds: string[]) {
    const uniqueIds = Array.from(new Set(authorIds));
    const users = await this.usersService.findByIds(uniqueIds);
    return new Map(
      users.map((user) => [
        user._id.toString(),
        this.usersService.toPublicUser(user, user._id.toString()),
      ]),
    );
  }

  /** Modération : suppression d'un post par un admin (sans vérif d'auteur). */
  async removePost(postId: string) {
    const deleted = await this.postModel.findByIdAndDelete(postId).exec();
    if (!deleted) {
      throw new NotFoundException('Post not found');
    }
    return { success: true };
  }

  /** Modération : suppression d'une alerte par un admin. */
  async removeAlert(alertId: string) {
    const deleted = await this.alertModel.findByIdAndDelete(alertId).exec();
    if (!deleted) {
      throw new NotFoundException('Alert not found');
    }
    return { success: true };
  }

  private async findPendingRequest(
    requestId: string,
  ): Promise<CertificationRequestDocument> {
    const request = await this.requestModel.findById(requestId).exec();
    if (!request) {
      throw new NotFoundException('Certification request not found');
    }
    if (request.status !== 'pending') {
      throw new BadRequestException('This request has already been reviewed');
    }
    return request;
  }
}
