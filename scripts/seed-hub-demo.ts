import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { HubDemoSeedService } from '../src/hub/services/hub-demo-seed.service';

const REQUIRED_CONFIRMATION = 'SEED_165_DEMO_RECORDS';

async function main(): Promise<void> {
  if (process.env.HUB_DEMO_SEED_CONFIRM !== REQUIRED_CONFIRMATION) {
    throw new Error(
      `Refusing to seed without HUB_DEMO_SEED_CONFIRM=${REQUIRED_CONFIRMATION}`,
    );
  }

  const application = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const service = application.get(HubDemoSeedService);
    const result = await service.seed();

    const expected = {
      rawRecords: 165,
      observations: 165,
      signals: 15,
      alerts: 3,
      sharingPolicies: 11,
      connectors: 33,
      ingestionRuns: 33,
    } as const;

    for (const [field, value] of Object.entries(expected)) {
      if (result[field as keyof typeof result] !== value) {
        throw new Error(
          `Unexpected seed result for ${field}: expected ${value}, received ${String(result[field as keyof typeof result])}`,
        );
      }
    }

    process.stdout.write(
      `${JSON.stringify(
        {
          status: 'ok',
          ...expected,
          idempotent: result.idempotent,
          message: result.message,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await application.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Hub demo seed failed: ${message}\n`);
  process.exitCode = 1;
});
