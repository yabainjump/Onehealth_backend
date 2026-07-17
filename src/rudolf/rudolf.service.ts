import {
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SendRudolfMessageDto } from './dto/send-rudolf-message.dto';
import {
  GroqProviderService,
  RudolfProviderError,
  RudolfProviderMessage,
} from './groq-provider.service';
import {
  RudolfConversation,
  RudolfMessage,
} from './schemas/rudolf-conversation.schema';

const MAX_STORED_MESSAGES = 40;
const MAX_CONTEXT_MESSAGES = 16;

@Injectable()
export class RudolfService {
  private readonly pendingByUser = new Map<string, Promise<void>>();

  constructor(
    @InjectModel(RudolfConversation.name)
    private readonly conversationModel: Model<RudolfConversation>,
    private readonly groqProvider: GroqProviderService,
  ) {}

  async getConversation(userId: string) {
    const conversation = await this.conversationModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .select({ messages: 1 })
      .lean()
      .exec();

    return {
      configured: this.groqProvider.isConfigured,
      model: this.groqProvider.model,
      messages: (conversation?.messages ?? []).map((message) =>
        this.toPublicMessage(message),
      ),
    };
  }

  sendMessage(userId: string, dto: SendRudolfMessageDto) {
    return this.runExclusive(userId, async () => {
      const conversation = await this.conversationModel
        .findOne({ userId: new Types.ObjectId(userId) })
        .select({ messages: 1 })
        .lean()
        .exec();

      const storedMessages = conversation?.messages ?? [];
      const context: RudolfProviderMessage[] = storedMessages
        .slice(-MAX_CONTEXT_MESSAGES)
        .map((message) => ({
          role: message.role,
          content: message.content,
        }));
      context.push({ role: 'user', content: dto.message });

      let answer: string;
      try {
        answer = await this.groqProvider.complete(context);
      } catch (error) {
        this.rethrowProviderError(error);
      }

      const now = new Date();
      const newMessages: RudolfMessage[] = [
        { role: 'user', content: dto.message, createdAt: now },
        { role: 'assistant', content: answer!, createdAt: new Date() },
      ];

      await this.conversationModel
        .updateOne(
          { userId: new Types.ObjectId(userId) },
          {
            $setOnInsert: { userId: new Types.ObjectId(userId) },
            $push: {
              messages: {
                $each: newMessages,
                $slice: -MAX_STORED_MESSAGES,
              },
            },
          },
          { upsert: true },
        )
        .exec();

      return {
        message: this.toPublicMessage(newMessages[1]),
      };
    });
  }

  async resetConversation(userId: string) {
    await this.conversationModel
      .deleteOne({ userId: new Types.ObjectId(userId) })
      .exec();
    return { success: true };
  }

  private toPublicMessage(message: RudolfMessage) {
    return {
      role: message.role,
      content: message.content,
      createdAt: new Date(message.createdAt).toISOString(),
    };
  }

  private rethrowProviderError(error: unknown): never {
    if (!(error instanceof RudolfProviderError)) {
      throw new ServiceUnavailableException(
        'Rudolf is temporarily unavailable.',
      );
    }
    if (error.kind === 'timeout') {
      throw new GatewayTimeoutException('Rudolf took too long to respond.');
    }
    if (error.kind === 'rate_limit') {
      throw new HttpException(
        'The AI provider is busy. Please try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (error.kind === 'not_configured' || error.kind === 'authentication') {
      throw new ServiceUnavailableException(
        'Rudolf is not configured correctly.',
      );
    }
    throw new ServiceUnavailableException('Rudolf is temporarily unavailable.');
  }

  private runExclusive<T>(
    userId: string,
    action: () => Promise<T>,
  ): Promise<T> {
    const previous = this.pendingByUser.get(userId) ?? Promise.resolve();
    const run = previous.then(action);
    const tracked = run
      .then(
        () => undefined,
        () => undefined,
      )
      .finally(() => {
        if (this.pendingByUser.get(userId) === tracked) {
          this.pendingByUser.delete(userId);
        }
      });
    this.pendingByUser.set(userId, tracked);
    return run;
  }
}
