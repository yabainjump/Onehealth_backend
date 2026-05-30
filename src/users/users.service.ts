import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { MongoServerError } from 'mongodb';
import { Model, Types } from 'mongoose';
import { PublicUser } from './interfaces/public-user.interface';
import { User, UserDocument, UserRole } from './schemas/user.schema';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  username: string;
  firstName: string;
  lastName: string;
  institution?: string;
  typeMedecin?: string;
  country?: string;
  city?: string;
  phone?: string;
  bio?: string;
  photoURL?: string;
  role?: UserRole;
}

export interface UpdateUserProfileInput {
  username?: string;
  firstName?: string;
  lastName?: string;
  institution?: string;
  typeMedecin?: string;
  country?: string;
  city?: string;
  phone?: string;
  bio?: string;
  photoURL?: string;
}

@Injectable()
export class UsersService {
  private static readonly ONLINE_WINDOW_MS = 90 * 1000;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async create(input: CreateUserInput): Promise<UserDocument> {
    try {
      const user = new this.userModel({
        ...input,
        email: input.email.toLowerCase().trim(),
        role: input.role ?? UserRole.USER,
        isOnline: false,
        lastSeenAt: new Date(),
      });

      return await user.save();
    } catch (error: unknown) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new ConflictException('Email already in use');
      }

      throw error;
    }
  }

  async findByEmail(
    email: string,
    includePasswordHash = false,
    includePasswordResetData = false,
  ): Promise<UserDocument | null> {
    const query = this.userModel.findOne({
      email: email.toLowerCase().trim(),
    });

    if (includePasswordHash) {
      query.select('+passwordHash');
    }

    if (includePasswordResetData) {
      query.select(
        '+passwordResetTokenHash +passwordResetExpiresAt +passwordResetRequestedAt',
      );
    }

    return query.exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByIds(ids: string[]): Promise<UserDocument[]> {
    const uniqueIds = Array.from(
      new Set(
        (ids || [])
          .map((id) => id?.toString().trim())
          .filter((id) => Types.ObjectId.isValid(id)),
      ),
    );

    if (!uniqueIds.length) {
      return [];
    }

    return this.userModel.find({ _id: { $in: uniqueIds } }).exec();
  }

  async updateById(
    id: string,
    updates: UpdateUserProfileInput,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(id, updates, {
        returnDocument: 'after',
        runValidators: true,
      })
      .exec();
  }

  async listUsers(search?: string, currentUserId?: string): Promise<PublicUser[]> {
    const query = search
      ? {
          $or: [
            { username: { $regex: search, $options: 'i' } },
            { firstName: { $regex: search, $options: 'i' } },
            { lastName: { $regex: search, $options: 'i' } },
            { institution: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const users = await this.userModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();

    return users.map((user) => this.toPublicUser(user, currentUserId));
  }

  async followUser(currentUserId: string, targetUserId: string): Promise<PublicUser> {
    this.assertDistinctUsers(currentUserId, targetUserId);
    const [currentUser, targetUser] = await Promise.all([
      this.findById(currentUserId),
      this.findById(targetUserId),
    ]);

    if (!currentUser) {
      throw new NotFoundException('Current user not found');
    }
    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    const currentObjectId = new Types.ObjectId(currentUserId);
    const targetObjectId = new Types.ObjectId(targetUserId);

    await Promise.all([
      this.userModel.updateOne(
        { _id: targetObjectId },
        { $addToSet: { followers: currentObjectId } },
      ),
      this.userModel.updateOne(
        { _id: currentObjectId },
        { $addToSet: { following: targetObjectId } },
      ),
    ]);

    const updatedTarget = await this.userModel.findById(targetObjectId).exec();
    if (!updatedTarget) {
      throw new NotFoundException('Target user not found');
    }
    return this.toPublicUser(updatedTarget, currentUserId);
  }

  async unfollowUser(currentUserId: string, targetUserId: string): Promise<PublicUser> {
    this.assertDistinctUsers(currentUserId, targetUserId);
    const [currentUser, targetUser] = await Promise.all([
      this.findById(currentUserId),
      this.findById(targetUserId),
    ]);

    if (!currentUser) {
      throw new NotFoundException('Current user not found');
    }
    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    const currentObjectId = new Types.ObjectId(currentUserId);
    const targetObjectId = new Types.ObjectId(targetUserId);

    await Promise.all([
      this.userModel.updateOne(
        { _id: targetObjectId },
        { $pull: { followers: currentObjectId } },
      ),
      this.userModel.updateOne(
        { _id: currentObjectId },
        { $pull: { following: targetObjectId } },
      ),
    ]);

    const updatedTarget = await this.userModel.findById(targetObjectId).exec();
    if (!updatedTarget) {
      throw new NotFoundException('Target user not found');
    }
    return this.toPublicUser(updatedTarget, currentUserId);
  }

  async markOnline(id: string): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        {
          isOnline: true,
          lastSeenAt: new Date(),
        },
        { returnDocument: 'after' },
      )
      .exec();
  }

  async touchPresence(id: string): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        {
          isOnline: true,
          lastSeenAt: new Date(),
        },
        { returnDocument: 'after' },
      )
      .exec();
  }

  async markOffline(id: string): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        {
          isOnline: false,
          lastSeenAt: new Date(),
        },
        { returnDocument: 'after' },
      )
      .exec();
  }

  async setPasswordResetTokenByEmail(
    email: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOneAndUpdate(
        { email: email.toLowerCase().trim() },
        {
          $set: {
            passwordResetTokenHash: tokenHash,
            passwordResetExpiresAt: expiresAt,
            passwordResetRequestedAt: new Date(),
          },
        },
        { returnDocument: 'after' },
      )
      .exec();
  }

  async resetPasswordByTokenHash(
    tokenHash: string,
    newPasswordHash: string,
    now: Date,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOneAndUpdate(
        {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: { $gt: now },
        },
        {
          $set: {
            passwordHash: newPasswordHash,
            isOnline: false,
            lastSeenAt: now,
          },
          $unset: {
            passwordResetTokenHash: '',
            passwordResetExpiresAt: '',
            passwordResetRequestedAt: '',
          },
        },
        { returnDocument: 'after' },
      )
      .exec();
  }

  toPublicUser(user: UserDocument, currentUserId?: string): PublicUser {
    const lastSeenAt = user.lastSeenAt ?? user.updatedAt ?? user.createdAt;
    const isOnline =
      !!user.isOnline &&
      !!lastSeenAt &&
      Date.now() - new Date(lastSeenAt).getTime() <=
        UsersService.ONLINE_WINDOW_MS;
    const followers = (user.followers || []).map((follower) => follower.toString());
    const following = (user.following || []).map((followedUser) => followedUser.toString());
    const viewerId = (currentUserId || '').trim();
    const isFollowing =
      !!viewerId &&
      viewerId !== user._id.toString() &&
      followers.includes(viewerId);

    return {
      id: user._id.toString(),
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      institution: user.institution,
      typeMedecin: user.typeMedecin ?? '',
      country: user.country ?? '',
      city: user.city ?? '',
      phone: user.phone ?? '',
      bio: user.bio ?? '',
      photoURL: user.photoURL ?? '',
      followersCount: followers.length,
      followingCount: following.length,
      isFollowing,
      role: user.role,
      isOnline,
      lastSeenAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private assertDistinctUsers(currentUserId: string, targetUserId: string) {
    const source = (currentUserId || '').trim();
    const target = (targetUserId || '').trim();

    if (!Types.ObjectId.isValid(source) || !Types.ObjectId.isValid(target)) {
      throw new BadRequestException('Invalid user id');
    }

    if (source === target) {
      throw new BadRequestException('You cannot follow yourself');
    }
  }
}

