import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { HealthModule } from '../src/health/health.module';
import { ObservabilityModule } from '../src/observability/observability.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthModule, ObservabilityModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('/api/health (GET)', () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];

    return request(httpServer)
      .get('/api/health')
      .expect(200)
      .expect((response) => {
        const body = response.body as { status?: string; timestamp?: string };
        expect(body.status).toBe('ok');
        expect(typeof body.timestamp).toBe('string');
        expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
      });
  });

  it('preserves a safe request ID and replaces an unsafe one', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];

    await request(httpServer)
      .get('/api/health/live')
      .set('X-Request-Id', 'dashboard:test-123')
      .expect('X-Request-Id', 'dashboard:test-123')
      .expect(200);

    await request(httpServer)
      .get('/api/health/live')
      .set('X-Request-Id', '<unsafe>')
      .expect(200)
      .expect((response) => {
        expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
        expect(response.headers['x-request-id']).not.toBe('<unsafe>');
      });
  });

  it('keeps unavailable readiness non-cacheable and correlated', () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];

    return request(httpServer)
      .get('/api/health/ready')
      .expect(503)
      .expect('Cache-Control', 'no-store')
      .expect('Retry-After', '5')
      .expect((response) => {
        expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
