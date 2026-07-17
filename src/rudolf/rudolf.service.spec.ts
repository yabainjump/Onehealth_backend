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

  function createModel(messages: RudolfConversation['messages'] = []) {
    const findQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(messages.length ? { messages } : null),
    };
    const updateQuery = {
      exec: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const deleteQuery = {
      exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    };
    const model = {
      findOne: jest.fn().mockReturnValue(findQuery),
      updateOne: jest.fn().mockReturnValue(updateQuery),
      deleteOne: jest.fn().mockReturnValue(deleteQuery),
    };
    return {
      model: model as unknown as Model<RudolfConversation>,
      updateOne: model.updateOne,
    };
  }

  it('uses server-side history and stores a bounded user/assistant pair', async () => {
    const history = [
      {
        role: 'assistant' as const,
        content: 'Ancienne réponse',
        createdAt: new Date(),
      },
    ];
    const { model, updateOne } = createModel(history);
    const complete = jest.fn().mockResolvedValue('Réponse One Health');
    const provider = {
      isConfigured: true,
      model: 'test-model',
      complete,
    } as unknown as GroqProviderService;
    const service = new RudolfService(model, provider);

    const result = await service.sendMessage(userId, {
      message: 'Question One Health',
    });

    expect(complete).toHaveBeenCalledWith([
      { role: 'assistant', content: 'Ancienne réponse' },
      { role: 'user', content: 'Question One Health' },
    ]);
    expect(result.message).toMatchObject({
      role: 'assistant',
      content: 'Réponse One Health',
    });
    expect(updateOne).toHaveBeenCalledTimes(1);
    const updateCall = updateOne.mock.calls[0] as unknown as [
      { userId: Types.ObjectId },
      { $push: { messages: { $slice: number } } },
      { upsert: boolean },
    ];
    expect(updateCall[0].userId.toString()).toBe(userId);
    expect(updateCall[1].$push.messages.$slice).toBe(-40);
    expect(updateCall[2]).toEqual({ upsert: true });
  });

  it('does not store the user message when Groq is not configured', async () => {
    const { model, updateOne } = createModel();
    const provider = {
      isConfigured: false,
      model: 'test-model',
      complete: jest
        .fn()
        .mockRejectedValue(new RudolfProviderError('not_configured')),
    } as unknown as GroqProviderService;
    const service = new RudolfService(model, provider);

    await expect(
      service.sendMessage(userId, { message: 'Question' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(updateOne).not.toHaveBeenCalled();
  });
});
