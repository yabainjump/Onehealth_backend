import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AlertsService } from './alerts.service';

describe('AlertsService moderation visibility', () => {
  it('filters hidden alerts when loading a public detail', async () => {
    const exec = jest.fn().mockResolvedValue(null);
    const findOne = jest.fn().mockReturnValue({ exec });
    const service = new AlertsService(
      { findOne } as never,
      {} as never,
      {} as never,
    );

    await expect(service.findById('alert-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findOne).toHaveBeenCalledWith({
      _id: 'alert-id',
      isHidden: { $ne: true },
      verificationStatus: { $ne: 'rejected' },
    });
  });

  it('resets a verified alert to pending when its author edits it', async () => {
    const authorId = new Types.ObjectId().toString();
    const existing = {
      authorId: new Types.ObjectId(authorId),
      lat: 3.8,
      lng: 11.5,
      verificationStatus: 'verified',
    };
    const updated = {
      ...existing,
      _id: new Types.ObjectId(),
      title: 'Titre corrigé',
      category: 'human',
      description: '',
      country: 'Cameroun',
      city: 'Yaoundé',
      severity: 'medium',
      verificationStatus: 'pending',
      reviewedAt: null,
      imageUrls: [],
      likedBy: [],
      comments: [],
      createdAt: new Date(),
    };
    const findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(existing),
    });
    const findOneAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(updated),
    });
    const service = new AlertsService(
      { findById, findOneAndUpdate } as never,
      { findByIds: jest.fn().mockResolvedValue([]) } as never,
      {} as never,
    );

    await service.update('alert-id', authorId, { title: 'Titre corrigé' });

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'alert-id' },
      {
        $set: expect.objectContaining({
          title: 'Titre corrigé',
          verificationStatus: 'pending',
          reviewedAt: null,
          reviewedBy: null,
        }) as Record<string, unknown>,
      },
      { new: true, runValidators: true },
    );
  });
});
