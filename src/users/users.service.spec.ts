import { Types } from 'mongoose';
import { UsersService } from './users.service';

describe('UsersService public profile privacy', () => {
  const service = new UsersService({} as never, {} as never, {} as never);
  const id = new Types.ObjectId();
  const now = new Date();
  const user = {
    _id: id,
    email: 'private@example.com',
    phone: '+237600000000',
    username: 'expert',
    firstName: 'One',
    lastName: 'Health',
    institution: 'OHN',
    typeMedecin: 'Vet',
    country: 'Cameroon',
    city: 'Douala',
    bio: '',
    photoURL: '',
    coverPhotoURL: '',
    followers: [],
    following: [],
    role: 'user',
    isCertified: false,
    certificationStatus: 'none',
    isBanned: false,
    isOnline: true,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
  } as never;

  it('does not expose email or phone to another viewer', () => {
    const result = service.toPublicUser(user, new Types.ObjectId().toString());
    expect(result.email).toBe('');
    expect(result.phone).toBe('');
  });

  it('keeps private fields for the account owner', () => {
    const result = service.toPublicUser(user, id.toString());
    expect(result.email).toBe('private@example.com');
    expect(result.phone).toBe('+237600000000');
  });

  it('keeps legacy Firebase profile images visible after migration', () => {
    const legacyUser = {
      ...(user as object),
      photo: 'https://firebasestorage.googleapis.com/legacy-avatar.png',
      coverPhoto: 'https://firebasestorage.googleapis.com/legacy-cover.png',
    } as never;

    const result = service.toPublicUser(legacyUser, id.toString());

    expect(result.photoURL).toContain('legacy-avatar.png');
    expect(result.coverPhotoURL).toContain('legacy-cover.png');
  });
});
