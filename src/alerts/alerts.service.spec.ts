import { NotFoundException } from '@nestjs/common';
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
    });
  });
});
