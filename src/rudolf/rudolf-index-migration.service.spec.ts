import { Model } from 'mongoose';
import { RudolfIndexMigrationService } from './rudolf-index-migration.service';
import { RudolfConversation } from './schemas/rudolf-conversation.schema';

describe('RudolfIndexMigrationService', () => {
  it('removes only the legacy unique user index', async () => {
    const indexes = jest.fn().mockResolvedValue([
      { name: '_id_', key: { _id: 1 } },
      { name: 'userId_1', key: { userId: 1 }, unique: true },
      { name: 'updatedAt_1', key: { updatedAt: 1 } },
    ]);
    const dropIndex = jest.fn().mockResolvedValue(undefined);
    const model = {
      collection: { indexes, dropIndex },
    } as unknown as Model<RudolfConversation>;

    await new RudolfIndexMigrationService(model).onModuleInit();

    expect(dropIndex).toHaveBeenCalledTimes(1);
    expect(dropIndex).toHaveBeenCalledWith('userId_1');
  });

  it('does nothing when the legacy index is already gone', async () => {
    const dropIndex = jest.fn();
    const model = {
      collection: {
        indexes: jest
          .fn()
          .mockResolvedValue([{ name: '_id_', key: { _id: 1 } }]),
        dropIndex,
      },
    } as unknown as Model<RudolfConversation>;

    await new RudolfIndexMigrationService(model).onModuleInit();

    expect(dropIndex).not.toHaveBeenCalled();
  });

  it('stays idempotent when another instance removes the index first', async () => {
    const model = {
      collection: {
        indexes: jest
          .fn()
          .mockResolvedValue([
            { name: 'userId_1', key: { userId: 1 }, unique: true },
          ]),
        dropIndex: jest
          .fn()
          .mockRejectedValue({ code: 27, codeName: 'IndexNotFound' }),
      },
    } as unknown as Model<RudolfConversation>;

    await expect(
      new RudolfIndexMigrationService(model).onModuleInit(),
    ).resolves.toBeUndefined();
  });
});
