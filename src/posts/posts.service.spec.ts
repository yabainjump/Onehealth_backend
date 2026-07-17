import { NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';

describe('PostsService moderation visibility', () => {
  it('filters hidden posts when loading a public detail', async () => {
    const exec = jest.fn().mockResolvedValue(null);
    const findOne = jest.fn().mockReturnValue({ exec });
    const service = new PostsService(
      { findOne } as never,
      {} as never,
      {} as never,
    );

    await expect(service.findById('post-id', '')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findOne).toHaveBeenCalledWith({
      _id: 'post-id',
      isHidden: { $ne: true },
    });
  });
});
