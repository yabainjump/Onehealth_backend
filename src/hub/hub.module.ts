import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HubController } from './controllers/hub.controller';
import { HUB_CONNECTION } from './hub.constants';
import { HubAdminGuard } from './guards/hub-admin.guard';
import { HubAccessGuard } from './guards/hub-access.guard';
import { HubVerifierGuard } from './guards/hub-verifier.guard';
import { HubAnalystGuard } from './guards/hub-analyst.guard';
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
import {
  HubScenarioRun,
  HubScenarioRunSchema,
} from './schemas/hub-scenario-run.schema';
import {
  HubAlertReport,
  HubAlertReportSchema,
} from './schemas/hub-alert-report.schema';
import { HubConnectorService } from './services/hub-connector.service';
import { HubDemoSeedService } from './services/hub-demo-seed.service';
import { HubService } from './services/hub.service';
import { HubScenarioService } from './services/hub-scenario.service';
import { HubReportService } from './services/hub-report.service';
import { HubEvent, HubEventSchema } from './schemas/hub-event.schema';
import { HubEventService } from './services/hub-event.service';
import { RudolfModule } from '../rudolf/rudolf.module';
import { HubAiService } from './services/hub-ai.service';

@Module({
  imports: [
    RudolfModule,
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
        { name: HubScenarioRun.name, schema: HubScenarioRunSchema },
        { name: HubAlertReport.name, schema: HubAlertReportSchema },
        { name: HubEvent.name, schema: HubEventSchema },
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
    HubScenarioService,
    HubReportService,
    HubEventService,
    HubAiService,
    HubAdminGuard,
    HubAccessGuard,
    HubVerifierGuard,
    HubAnalystGuard,
  ],
})
export class HubModule {}
