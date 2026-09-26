import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OpenRouterProviderService } from './openrouter-provider.service';
import { RudolfController } from './rudolf.controller';
import { RudolfIndexMigrationService } from './rudolf-index-migration.service';
import { RudolfRateLimitGuard } from './rudolf-rate-limit.guard';
import { RudolfService } from './rudolf.service';
import {
  RudolfConversation,
  RudolfConversationSchema,
} from './schemas/rudolf-conversation.schema';
import { CoordinationModule } from '../coordination/coordination.module';

@Module({
  imports: [
    CoordinationModule,
    MongooseModule.forFeature([
      {
        name: RudolfConversation.name,
        schema: RudolfConversationSchema,
      },
    ]),
  ],
  controllers: [RudolfController],
  providers: [
    OpenRouterProviderService,
    RudolfIndexMigrationService,
    RudolfRateLimitGuard,
    RudolfService,
  ],
  exports: [OpenRouterProviderService, RudolfRateLimitGuard, RudolfService],
})
export class RudolfModule {}
