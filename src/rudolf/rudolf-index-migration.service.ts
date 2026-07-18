import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RudolfConversation } from './schemas/rudolf-conversation.schema';

/**
 * Rudolf utilisait initialement un index unique sur userId. Le multi-chat
 * exige plusieurs documents par utilisateur. Cette migration ne supprime
 * aucune conversation : elle retire uniquement cet ancien index unique.
 */
@Injectable()
export class RudolfIndexMigrationService implements OnModuleInit {
  private readonly logger = new Logger(RudolfIndexMigrationService.name);

  constructor(
    @InjectModel(RudolfConversation.name)
    private readonly conversationModel: Model<RudolfConversation>,
  ) {}

  async onModuleInit(): Promise<void> {
    const indexes = await this.conversationModel.collection.indexes();
    const legacyIndex = indexes.find((index) => {
      const key = index.key as Record<string, number> | undefined;
      return (
        index.unique === true &&
        key?.userId === 1 &&
        Object.keys(key).length === 1
      );
    });

    if (!legacyIndex?.name) return;

    try {
      await this.conversationModel.collection.dropIndex(legacyIndex.name);
    } catch (error: unknown) {
      // Deux instances peuvent démarrer au même moment : si l'autre a déjà
      // retiré l'index, la migration est tout de même terminée correctement.
      if (this.isIndexNotFound(error)) return;
      throw error;
    }
    this.logger.log(
      `Removed legacy unique Rudolf index "${legacyIndex.name}" for multi-conversation support.`,
    );
  }

  private isIndexNotFound(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const mongoError = error as { code?: number; codeName?: string };
    return mongoError.code === 27 || mongoError.codeName === 'IndexNotFound';
  }
}
