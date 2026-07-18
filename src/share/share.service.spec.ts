import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ShareService } from './share.service';

describe('ShareService moderation visibility', () => {
  it('uses the versioned official logo and current application description', () => {
    const config = new Map<string, string>([
      ['FRONTEND_PUBLIC_URL', 'https://onehealthnetwork.yaba-in.com'],
      ['PUBLIC_BASE_URL', 'https://backend.onehealthnetwork.yaba-in.com'],
    ]);
    const service = new ShareService(
      {} as never,
      {} as never,
      { get: (key: string) => config.get(key) } as never,
    );

    const metadata = service.getSiteShareMetadata();

    expect(metadata.imageUrl).toBe(
      'https://onehealthnetwork.yaba-in.com/assets/icon/brand-icon-512.png?v=20260718',
    );
    expect(metadata.twitterCard).toBe('summary');
    expect(metadata.imageType).toBe('image/png');
    expect(metadata.description).toContain('Rudolf AI');
    expect(metadata.description).toContain('végétale');
  });

  it('does not generate metadata for a hidden post', async () => {
    const exec = jest.fn().mockResolvedValue(null);
    const findOne = jest.fn().mockReturnValue({ exec });
    const service = new ShareService(
      { findOne } as never,
      {} as never,
      {} as never,
    );
    const postId = new Types.ObjectId().toString();

    await expect(service.getPostShareMetadata(postId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findOne).toHaveBeenCalledWith({
      _id: postId,
      isHidden: { $ne: true },
    });
  });

  it('requests a high-resolution Google avatar and uses a French profile fallback', async () => {
    const userId = new Types.ObjectId().toString();
    const user = {
      firstName: 'Raphael',
      lastName: 'Taptue',
      username: 'raphael',
      bio: '',
      photoURL: 'https://lh3.googleusercontent.com/a/example-avatar=s96-c',
    };
    const config = new Map<string, string>([
      ['FRONTEND_PUBLIC_URL', 'https://onehealthnetwork.yaba-in.com'],
      ['PUBLIC_BASE_URL', 'https://backend.onehealthnetwork.yaba-in.com'],
    ]);
    const service = new ShareService(
      {} as never,
      {
        findById: jest
          .fn()
          .mockReturnValue({ exec: () => Promise.resolve(user) }),
      } as never,
      { get: (key: string) => config.get(key) } as never,
    );

    const metadata = await service.getProfileShareMetadata(userId);

    expect(metadata.imageUrl).toBe(
      'https://lh3.googleusercontent.com/a/example-avatar=s800-c',
    );
    expect(metadata.description).toBe(
      'Raphael Taptue est membre de One Health Network.',
    );
  });
});
