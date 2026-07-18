import { ServiceUnavailableException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import {
  GroqProviderService,
  RudolfProviderError,
} from './groq-provider.service';
import { RudolfConversation } from './schemas/rudolf-conversation.schema';
import { RudolfService } from './rudolf.service';

describe('RudolfService', () => {
  const userId = new Types.ObjectId().toString();
  const conversationId = new Types.ObjectId();
  const now = new Date();

  const conversation = {
    _id: conversationId,
    title: 'Ancienne conversation',
    messages: [
      {
        role: 'assistant' as const,
        content: 'Ancienne réponse',
        createdAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
  };

  function createModel(findResult: unknown = conversation) {
    const findOneQuery = {
      sort: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(findResult),
    };
    const aggregateQuery = {
      exec: jest.fn().mockResolvedValue(findResult ? [findResult] : []),
    };
    const updateQuery = {
      exec: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const deleteQuery = {
      exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    };
    const countQuery = {
      exec: jest.fn().mockResolvedValue(0),
    };
    const model = {
      findOne: jest.fn().mockReturnValue(findOneQuery),
      aggregate: jest.fn().mockReturnValue(aggregateQuery),
      updateOne: jest.fn().mockReturnValue(updateQuery),
      deleteOne: jest.fn().mockReturnValue(deleteQuery),
      deleteMany: jest.fn().mockReturnValue(deleteQuery),
      countDocuments: jest.fn().mockReturnValue(countQuery),
      create: jest.fn(),
    };

    return {
      model: model as unknown as Model<RudolfConversation>,
      findOne: model.findOne,
      aggregate: model.aggregate,
      updateOne: model.updateOne,
    };
  }

  it('streams with server-side history and persists one bounded exchange', async () => {
    const { model, findOne, updateOne } = createModel();
    const stream = jest.fn().mockImplementation(async function* () {
      await Promise.resolve();
      yield 'Réponse ';
      yield 'One Health';
    });
    const provider = {
      isConfigured: true,
      model: 'test-model',
      stream,
    } as unknown as GroqProviderService;
    const service = new RudolfService(model, provider);
    const deltas: string[] = [];

    const result = await service.streamMessage(
      userId,
      conversationId.toString(),
      { message: 'Question One Health' },
      (delta) => deltas.push(delta),
    );

    expect(findOne).toHaveBeenCalledWith({
      _id: conversationId,
      userId: new Types.ObjectId(userId),
    });
    expect(stream).toHaveBeenCalledWith([
      { role: 'assistant', content: 'Ancienne réponse' },
      { role: 'user', content: 'Question One Health' },
    ]);
    expect(deltas).toEqual(['Réponse ', 'One Health']);
    expect(result.message).toMatchObject({
      role: 'assistant',
      content: 'Réponse One Health',
    });

    const updateCall = updateOne.mock.calls[0] as unknown as [
      { _id: Types.ObjectId; userId: Types.ObjectId },
      {
        $push: { messages: { $slice: number } };
        $set: { lastMessageAt: Date };
      },
    ];
    expect(updateCall[0]._id).toEqual(conversationId);
    expect(updateCall[0].userId.toString()).toBe(userId);
    expect(updateCall[1].$push.messages.$slice).toBe(-40);
    expect(updateCall[1].$set.lastMessageAt).toBeInstanceOf(Date);
  });

  it('does not persist partial output when the provider fails', async () => {
    const { model, updateOne } = createModel();
    const provider = {
      isConfigured: true,
      model: 'test-model',
      stream: jest.fn().mockImplementation(async function* () {
        await Promise.resolve();
        yield 'Début';
        throw new RudolfProviderError('unavailable');
      }),
    } as unknown as GroqProviderService;
    const service = new RudolfService(model, provider);

    await expect(
      service.streamMessage(
        userId,
        conversationId.toString(),
        { message: 'Question' },
        () => undefined,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('lists only the authenticated user conversations', async () => {
    const summaryRow = {
      ...conversation,
      messages: undefined,
      firstQuestion: undefined,
      lastMessage: conversation.messages[0],
      messageCount: 1,
    };
    const { model, aggregate } = createModel(summaryRow);
    const provider = {
      isConfigured: true,
      model: 'test-model',
    } as unknown as GroqProviderService;
    const service = new RudolfService(model, provider);

    const result = await service.listConversations(userId);

    expect(aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        { $match: { userId: new Types.ObjectId(userId) } },
        { $limit: 50 },
      ]),
    );
    expect(result.conversations).toHaveLength(1);
    expect(result.conversations[0]).toMatchObject({
      id: conversationId.toString(),
      title: 'Ancienne conversation',
    });
  });
});
