import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ShareService } from './share.service';

describe('ShareService moderation visibility', () => {
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
});
