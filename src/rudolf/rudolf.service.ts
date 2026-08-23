import {
  ConflictException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CoordinationUnavailableError,
  LeaseBusyError,
} from '../coordination/coordination.errors';
import {
  DistributedLeaseService,
  LeaseHandle,
} from '../coordination/distributed-lease.service';
import { RuntimeLifecycleService } from '../runtime/runtime-lifecycle.service';
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
const MAX_CONVERSATIONS_PER_USER = 50;
const MAX_ANSWER_CHARACTERS = 12_000;
const DEFAULT_TITLE = 'Conversation One Health';

type ConversationRow = {
  _id: Types.ObjectId;
  title?: string;
  messages: RudolfMessage[];
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
};

type ConversationSummaryRow = Omit<ConversationRow, 'messages'> & {
  firstQuestion?: RudolfMessage;
  lastMessage?: RudolfMessage;
  messageCount: number;
};

export type RudolfConversationSummary = {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type RudolfStreamResult = {
  message: ReturnType<RudolfService['toPublicMessage']>;
  conversation: RudolfConversationSummary;
};

export class RudolfConversationBusyException extends ConflictException {
  constructor(readonly retryAfterSeconds: number) {
    super({
      statusCode: HttpStatus.CONFLICT,
      error: 'Conflict',
      code: 'conversation_busy',
      message: 'This Rudolf conversation is already processing a request.',
    });
  }
}

@Injectable()
export class RudolfService {
  private readonly logger = new Logger(RudolfService.name);

  constructor(
    @InjectModel(RudolfConversation.name)
    private readonly conversationModel: Model<RudolfConversation>,
    private readonly groqProvider: GroqProviderService,
    private readonly distributedLease: DistributedLeaseService,
    private readonly lifecycle: RuntimeLifecycleService,
  ) {}

  async listConversations(userId: string) {
    const conversations = await this.conversationModel
      .aggregate<ConversationSummaryRow>([
        { $match: { userId: this.toObjectId(userId) } },
        { $sort: { updatedAt: -1 } },
        { $limit: MAX_CONVERSATIONS_PER_USER },
        {
          $project: {
            title: 1,
            createdAt: 1,
            updatedAt: 1,
            lastMessageAt: 1,
            messageCount: { $size: { $ifNull: ['$messages', []] } },
            firstQuestion: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: { $ifNull: ['$messages', []] },
                    as: 'message',
                    cond: { $eq: ['$$message.role', 'user'] },
                  },
                },
                0,
              ],
            },
            lastMessage: {
              $arrayElemAt: [{ $ifNull: ['$messages', []] }, -1],
            },
          },
        },
      ])
      .exec();

    return {
      configured: this.groqProvider.isConfigured,
      model: this.groqProvider.model,
      conversations: conversations.map((conversation) =>
        this.toProjectedConversationSummary(conversation),
      ),
    };
  }

  async createConversation(userId: string) {
    const ownerId = this.toObjectId(userId);
    const count = await this.conversationModel
      .countDocuments({ userId: ownerId })
      .exec();

    if (count >= MAX_CONVERSATIONS_PER_USER) {
      throw new ConflictException(
        'Delete an old Rudolf conversation before creating a new one.',
      );
    }

    const now = new Date();
    const conversation = await this.conversationModel.create({
      userId: ownerId,
      title: DEFAULT_TITLE,
      messages: [],
      lastMessageAt: now,
    });

    const row: ConversationRow = {
      _id: conversation._id,
      title: conversation.title,
      messages: [],
      createdAt: conversation.createdAt ?? now,
      updatedAt: conversation.updatedAt ?? now,
      lastMessageAt: conversation.lastMessageAt ?? now,
    };

    return {
      configured: this.groqProvider.isConfigured,
      model: this.groqProvider.model,
      conversation: this.toConversationSummary(row),
      messages: [],
    };
  }

  async getConversationById(userId: string, conversationId: string) {
    const conversation = await this.findOwnedConversation(
      userId,
      conversationId,
    );

    return {
      configured: this.groqProvider.isConfigured,
      model: this.groqProvider.model,
      conversation: this.toConversationSummary(conversation),
      messages: conversation.messages.map((message) =>
        this.toPublicMessage(message),
      ),
    };
  }

  async deleteConversation(userId: string, conversationId: string) {
    const conversationObjectId = this.toConversationObjectId(conversationId);
    const key = this.lockKey(userId, conversationId);

    return this.runExclusive(key, async () => {
      const result = await this.conversationModel
        .deleteOne({
          _id: conversationObjectId,
          userId: this.toObjectId(userId),
        })
        .exec();

      if (!result.deletedCount) {
        throw new NotFoundException('Rudolf conversation not found.');
      }
      return { success: true };
    });
  }

  async streamMessage(
    userId: string,
    conversationId: string,
    dto: SendRudolfMessageDto,
    onDelta: (delta: string) => void | Promise<void>,
    clientSignal?: AbortSignal,
  ): Promise<RudolfStreamResult> {
    const key = this.lockKey(userId, conversationId);
    return this.runExclusive(key, async () => {
      const conversation = await this.findOwnedConversation(
        userId,
        conversationId,
      );
      const context = this.buildContext(conversation.messages, dto.message);
      let answer = '';
      const signal = this.operationSignal(clientSignal);

      try {
        for await (const delta of this.groqProvider.stream(context, signal)) {
          const remaining = MAX_ANSWER_CHARACTERS - answer.length;
          if (remaining <= 0) break;
          const safeDelta = delta.slice(0, remaining);
          answer += safeDelta;
          await onDelta(safeDelta);
          this.throwIfAborted(signal);
        }
      } catch (error) {
        this.rethrowProviderError(error);
      }

      this.throwIfAborted(signal);
      const normalizedAnswer = answer.trim();
      if (!normalizedAnswer) {
        throw new ServiceUnavailableException(
          'Rudolf is temporarily unavailable.',
        );
      }

      return this.persistExchange(
        conversation,
        userId,
        dto.message,
        normalizedAnswer,
      );
    });
  }

  /**
   * Endpoint non-streaming conservé pour les anciens clients mobiles pendant
   * leur mise à jour.
   */
  async sendMessageToConversation(
    userId: string,
    conversationId: string,
    dto: SendRudolfMessageDto,
    clientSignal?: AbortSignal,
  ) {
    const key = this.lockKey(userId, conversationId);
    return this.runExclusive(key, async () => {
      const conversation = await this.findOwnedConversation(
        userId,
        conversationId,
      );
      const context = this.buildContext(conversation.messages, dto.message);
      const signal = this.operationSignal(clientSignal);

      let answer: string;
      try {
        answer = await this.groqProvider.complete(context, undefined, signal);
      } catch (error) {
        this.rethrowProviderError(error);
      }

      this.throwIfAborted(signal);
      return this.persistExchange(conversation, userId, dto.message, answer!);
    });
  }

  /**
   * Compatibilité avec la première version mono-conversation.
   */
  async getConversation(userId: string) {
    const conversation = await this.findLatestConversation(userId);
    return {
      configured: this.groqProvider.isConfigured,
      model: this.groqProvider.model,
      messages: (conversation?.messages ?? []).map((message) =>
        this.toPublicMessage(message),
      ),
    };
  }

  async sendMessage(userId: string, dto: SendRudolfMessageDto) {
    let conversation = await this.findLatestConversation(userId);
    if (!conversation) {
      await this.createConversation(userId);
      conversation = await this.findLatestConversation(userId);
    }
    if (!conversation) {
      throw new ServiceUnavailableException(
        'Rudolf conversation could not be created.',
      );
    }

    const result = await this.sendMessageToConversation(
      userId,
      conversation._id.toString(),
      dto,
    );
    return { message: result.message };
  }

  async resetConversation(userId: string) {
    const ownerId = this.toObjectId(userId);
    const conversations = await this.conversationModel
      .find({ userId: ownerId })
      .select({ _id: 1 })
      .lean<Array<{ _id: Types.ObjectId }>>()
      .exec();

    await Promise.all(
      conversations.map((conversation) =>
        this.deleteConversation(userId, conversation._id.toString()),
      ),
    );
    return { success: true };
  }

  private async findOwnedConversation(
    userId: string,
    conversationId: string,
  ): Promise<ConversationRow> {
    const conversation = await this.conversationModel
      .findOne({
        _id: this.toConversationObjectId(conversationId),
        userId: this.toObjectId(userId),
      })
      .select({
        title: 1,
        messages: 1,
        createdAt: 1,
        updatedAt: 1,
        lastMessageAt: 1,
      })
      .lean<ConversationRow>()
      .exec();

    if (!conversation) {
      throw new NotFoundException('Rudolf conversation not found.');
    }
    return conversation;
  }

  private findLatestConversation(
    userId: string,
  ): Promise<ConversationRow | null> {
    return this.conversationModel
      .findOne({ userId: this.toObjectId(userId) })
      .sort({ updatedAt: -1 })
      .select({
        title: 1,
        messages: 1,
        createdAt: 1,
        updatedAt: 1,
        lastMessageAt: 1,
      })
      .lean<ConversationRow>()
      .exec();
  }

  private buildContext(
    storedMessages: RudolfMessage[],
    newMessage: string,
  ): RudolfProviderMessage[] {
    const context: RudolfProviderMessage[] = storedMessages
      .slice(-MAX_CONTEXT_MESSAGES)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));
    context.push({ role: 'user', content: newMessage });
    return context;
  }

  private async persistExchange(
    conversation: ConversationRow,
    userId: string,
    question: string,
    answer: string,
  ): Promise<RudolfStreamResult> {
    const userMessage: RudolfMessage = {
      role: 'user',
      content: question,
      createdAt: new Date(),
    };
    const assistantMessage: RudolfMessage = {
      role: 'assistant',
      content: answer.slice(0, MAX_ANSWER_CHARACTERS),
      createdAt: new Date(),
    };
    const isFirstExchange = conversation.messages.length === 0;
    const title = isFirstExchange
      ? this.createTitle(question)
      : conversation.title || DEFAULT_TITLE;

    await this.conversationModel
      .updateOne(
        {
          _id: conversation._id,
          userId: this.toObjectId(userId),
        },
        {
          $set: {
            title,
            lastMessageAt: assistantMessage.createdAt,
          },
          $push: {
            messages: {
              $each: [userMessage, assistantMessage],
              $slice: -MAX_STORED_MESSAGES,
            },
          },
        },
      )
      .exec();

    const updatedConversation: ConversationRow = {
      ...conversation,
      title,
      messages: [...conversation.messages, userMessage, assistantMessage].slice(
        -MAX_STORED_MESSAGES,
      ),
      updatedAt: assistantMessage.createdAt,
      lastMessageAt: assistantMessage.createdAt,
    };

    return {
      message: this.toPublicMessage(assistantMessage),
      conversation: this.toConversationSummary(updatedConversation),
    };
  }

  private createTitle(question: string): string {
    const normalized = question.replace(/\s+/g, ' ').trim();
    if (normalized.length <= 58) return normalized;
    return `${normalized.slice(0, 57).trimEnd()}…`;
  }

  private toConversationSummary(
    conversation: ConversationRow,
  ): RudolfConversationSummary {
    const lastMessage = conversation.messages.at(-1);
    const firstQuestion = conversation.messages.find(
      (message) => message.role === 'user',
    );
    const title =
      conversation.title && conversation.title !== DEFAULT_TITLE
        ? conversation.title
        : firstQuestion
          ? this.createTitle(firstQuestion.content)
          : DEFAULT_TITLE;
    const preview = lastMessage?.content.replace(/\s+/g, ' ').trim() ?? '';

    return {
      id: conversation._id.toString(),
      title,
      preview: preview.slice(0, 100),
      messageCount: conversation.messages.length,
      createdAt: new Date(conversation.createdAt).toISOString(),
      updatedAt: new Date(
        conversation.lastMessageAt ?? conversation.updatedAt,
      ).toISOString(),
    };
  }

  private toProjectedConversationSummary(
    conversation: ConversationSummaryRow,
  ): RudolfConversationSummary {
    const title =
      conversation.title && conversation.title !== DEFAULT_TITLE
        ? conversation.title
        : conversation.firstQuestion
          ? this.createTitle(conversation.firstQuestion.content)
          : DEFAULT_TITLE;
    const preview =
      conversation.lastMessage?.content.replace(/\s+/g, ' ').trim() ?? '';

    return {
      id: conversation._id.toString(),
      title,
      preview: preview.slice(0, 100),
      messageCount: conversation.messageCount,
      createdAt: new Date(conversation.createdAt).toISOString(),
      updatedAt: new Date(
        conversation.lastMessageAt ?? conversation.updatedAt,
      ).toISOString(),
    };
  }

  toPublicMessage(message: RudolfMessage) {
    return {
      role: message.role,
      content: message.content,
      createdAt: new Date(message.createdAt).toISOString(),
    };
  }

  private toObjectId(userId: string): Types.ObjectId {
    return new Types.ObjectId(userId);
  }

  private toConversationObjectId(conversationId: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new NotFoundException('Rudolf conversation not found.');
    }
    return new Types.ObjectId(conversationId);
  }

  private lockKey(userId: string, conversationId: string): string {
    return `${userId}:${conversationId}`;
  }

  private rethrowProviderError(error: unknown): never {
    if (!(error instanceof RudolfProviderError)) {
      throw new ServiceUnavailableException(
        'Rudolf is temporarily unavailable.',
      );
    }
    if (error.kind === 'aborted') {
      throw new ServiceUnavailableException(
        'Rudolf request was interrupted before completion.',
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

  private async runExclusive<T>(
    key: string,
    action: () => Promise<T>,
  ): Promise<T> {
    let lease: LeaseHandle;
    try {
      lease = await this.distributedLease.acquire({
        namespace: 'rudolf-conversation',
        resource: key,
      });
    } catch (error) {
      if (error instanceof LeaseBusyError) {
        throw new RudolfConversationBusyException(error.retryAfterSeconds);
      }
      if (error instanceof CoordinationUnavailableError) {
        throw new ServiceUnavailableException(
          'Rudolf coordination is temporarily unavailable.',
        );
      }
      throw error;
    }

    try {
      return await action();
    } finally {
      try {
        await this.distributedLease.release(lease);
      } catch {
        this.logger.warn(
          'A Rudolf conversation lease could not be released; TTL recovery remains active.',
        );
      }
    }
  }

  private operationSignal(clientSignal?: AbortSignal): AbortSignal {
    if (!clientSignal) return this.lifecycle.shutdownSignal;
    return AbortSignal.any([clientSignal, this.lifecycle.shutdownSignal]);
  }

  private throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) {
      this.rethrowProviderError(new RudolfProviderError('aborted'));
    }
  }
}
