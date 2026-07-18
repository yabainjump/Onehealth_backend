import { Types } from 'mongoose';
import { AdminService } from './admin.service';

describe('AdminService alert verification', () => {
  it('returns alert review counters in dashboard statistics', async () => {
    const countResult = (value: number) => ({
      exec: jest.fn().mockResolvedValue(value),
    });
    const userModel = {
      countDocuments: jest
        .fn()
        .mockReturnValueOnce(countResult(120))
        .mockReturnValueOnce(countResult(34))
        .mockReturnValueOnce(countResult(3)),
    };
    const postModel = { countDocuments: jest.fn(() => countResult(48)) };
    const requestModel = { countDocuments: jest.fn(() => countResult(7)) };
    const alertModel = {
      countDocuments: jest
        .fn()
        .mockReturnValueOnce(countResult(19))
        .mockReturnValueOnce(countResult(5))
        .mockReturnValueOnce(countResult(12)),
    };
    const service = new AdminService(
      userModel as never,
      postModel as never,
      alertModel as never,
      requestModel as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.getStats()).resolves.toEqual({
      totalUsers: 120,
      certifiedUsers: 34,
      bannedUsers: 3,
      pendingCertifications: 7,
      totalPosts: 48,
      totalAlerts: 19,
      pendingAlerts: 5,
      verifiedAlerts: 12,
    });
  });

  it('filters legacy and current pending alerts in the moderation list', async () => {
    const query = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    const alertModel = {
      find: jest.fn().mockReturnValue(query),
      countDocuments: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      }),
    };
    const usersService = {
      findByIds: jest.fn().mockResolvedValue([]),
      toPublicUser: jest.fn(),
    };
    const service = new AdminService(
      {} as never,
      {} as never,
      alertModel as never,
      {} as never,
      usersService as never,
      {} as never,
      {} as never,
    );

    await service.listAlerts('ebola', 1, 20, 'pending');

    expect(alertModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $and: [
          {
            $or: [
              { verificationStatus: 'pending' },
              { verificationStatus: { $exists: false } },
            ],
          },
        ],
      }),
    );
  });

  it('stores the reviewer and notifies users on the first verification', async () => {
    const alertId = new Types.ObjectId().toString();
    const reviewerId = new Types.ObjectId().toString();
    const previous = { verificationStatus: 'pending' };
    const updated = {
      _id: new Types.ObjectId(alertId),
      verificationStatus: 'verified',
      reviewedAt: new Date(),
    };
    const alertModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(previous),
      }),
      findByIdAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(updated),
      }),
    };
    const alertsService = {
      notifyVerifiedAlert: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AdminService(
      {} as never,
      {} as never,
      alertModel as never,
      {} as never,
      {} as never,
      {} as never,
      alertsService as never,
    );

    const result = await service.setAlertVerification(
      alertId,
      'verified',
      reviewerId,
    );

    expect(alertModel.findByIdAndUpdate).toHaveBeenCalledWith(
      alertId,
      {
        $set: expect.objectContaining({
          verificationStatus: 'verified',
          reviewedBy: new Types.ObjectId(reviewerId),
        }) as Record<string, unknown>,
      },
      { new: true, runValidators: true },
    );
    expect(alertsService.notifyVerifiedAlert).toHaveBeenCalledWith(alertId);
    expect(result.verificationStatus).toBe('verified');
  });
});
