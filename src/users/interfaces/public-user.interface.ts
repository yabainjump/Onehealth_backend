import { CertificationStatus, HubRole, UserRole } from '../schemas/user.schema';

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  institution: string;
  typeMedecin: string;
  country: string;
  city: string;
  phone: string;
  bio: string;
  photoURL: string;
  coverPhotoURL: string;
  followersCount: number;
  followingCount: number;
  postsCount?: number;
  isFollowing: boolean;
  role: UserRole;
  hubRoles: HubRole[];
  hubCountryCodes: string[];
  isCertified: boolean;
  certificationStatus: CertificationStatus;
  isBanned: boolean;
  isOnline: boolean;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
