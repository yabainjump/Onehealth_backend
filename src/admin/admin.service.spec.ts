import { Types } from 'mongoose';
import { AdminService } from './admin.service';

describe('AdminService alert verification', () => {
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
