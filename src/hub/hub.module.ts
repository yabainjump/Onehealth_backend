import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HubController } from './controllers/hub.controller';
import { HUB_CONNECTION } from './hub.constants';
import { HubAdminGuard } from './guards/hub-admin.guard';
import { HubAccessGuard } from './guards/hub-access.guard';
import { HubVerifierGuard } from './guards/hub-verifier.guard';
import { HubConnectorRepository } from './repositories/hub-connector.repository';
import { HubRepository } from './repositories/hub.repository';
import { HubAlert, HubAlertSchema } from './schemas/hub-alert.schema';
import { HubAuditLog, HubAuditLogSchema } from './schemas/hub-audit-log.schema';
import {
  HubConnector,
  HubConnectorSchema,
} from './schemas/hub-connector.schema';
import {
  HubIngestionRun,
  HubIngestionRunSchema,
} from './schemas/hub-ingestion-run.schema';
import {
  HubObservation,
  HubObservationSchema,
} from './schemas/hub-observation.schema';
import {
  HubRawRecord,
  HubRawRecordSchema,
} from './schemas/hub-raw-record.schema';
import {
  HubSharingPolicy,
  HubSharingPolicySchema,
} from './schemas/hub-sharing-policy.schema';
import { HubSignal, HubSignalSchema } from './schemas/hub-signal.schema';
import { HubConnectorService } from './services/hub-connector.service';
import { HubDemoSeedService } from './services/hub-demo-seed.service';
import { HubService } from './services/hub.service';

@Module({
  imports: [
    MongooseModule.forFeature(
      [
        { name: HubRawRecord.name, schema: HubRawRecordSchema },
        { name: HubObservation.name, schema: HubObservationSchema },
        { name: HubSignal.name, schema: HubSignalSchema },
        { name: HubAlert.name, schema: HubAlertSchema },
        { name: HubAuditLog.name, schema: HubAuditLogSchema },
        { name: HubSharingPolicy.name, schema: HubSharingPolicySchema },
        { name: HubConnector.name, schema: HubConnectorSchema },
        { name: HubIngestionRun.name, schema: HubIngestionRunSchema },
      ],
      HUB_CONNECTION,
    ),
  ],
  controllers: [HubController],
  providers: [
    HubRepository,
    HubConnectorRepository,
    HubService,
    HubConnectorService,
    HubDemoSeedService,
    HubAdminGuard,
    HubAccessGuard,
    HubVerifierGuard,
  ],
})
export class HubModule {}
