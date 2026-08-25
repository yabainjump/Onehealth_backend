import { Types } from 'mongoose';
import { UsersService } from './users.service';
import { UserPhotoSource } from './schemas/user.schema';

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

describe('UsersService profile photo ownership', () => {
  it('marks a manually updated photo so Google cannot overwrite it', async () => {
    const exec = jest
      .fn()
      .mockResolvedValue({ photoURL: '/uploads/profile/me.webp' });
    const findByIdAndUpdate = jest.fn().mockReturnValue({ exec });
    const service = new UsersService(
      { findByIdAndUpdate } as never,
      {} as never,
      {} as never,
    );
    const id = new Types.ObjectId().toString();

    await service.updateById(id, {
      photoURL: '/uploads/profile/me.webp',
    });

    expect(findByIdAndUpdate).toHaveBeenCalledWith(
      id,
      {
        photoURL: '/uploads/profile/me.webp',
        photoSource: UserPhotoSource.USER,
        googlePhotoURL: '',
      },
      {
        returnDocument: 'after',
        runValidators: true,
      },
    );
  });
});

describe('UsersService atomic session presence', () => {
  it('filtre atomiquement les comptes bannis et les sessions révoquées', async () => {
    const exec = jest.fn().mockResolvedValue(null);
    const findOneAndUpdate = jest.fn().mockReturnValue({ exec });
    const service = new UsersService(
      { findOneAndUpdate } as never,
      {} as never,
      {} as never,
    );
    const sessionUpperBound = new Date('2026-08-25T10:00:01.000Z');

    await service.touchPresenceForValidSession('user-1', sessionUpperBound);

    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    const [filter, update, options] = findOneAndUpdate.mock
      .calls[0] as unknown as [
      Record<string, unknown>,
      { isOnline: boolean; lastSeenAt: Date },
      Record<string, unknown>,
    ];

    expect(filter).toEqual({
      _id: 'user-1',
      isBanned: { $ne: true },
      $or: [
        { passwordChangedAt: null },
        { passwordChangedAt: { $exists: false } },
        { passwordChangedAt: { $lt: sessionUpperBound } },
      ],
    });
    expect(update.isOnline).toBe(true);
    expect(update.lastSeenAt).toBeInstanceOf(Date);
    expect(options).toEqual({ returnDocument: 'after' });
  });
});
