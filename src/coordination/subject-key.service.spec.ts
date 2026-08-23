import { ConfigService } from '@nestjs/config';
import { SubjectKeyService } from './subject-key.service';

describe('SubjectKeyService', () => {
  const rawSubject = '203.0.113.42';
  const secret = 'a'.repeat(64);

  const createService = (configuredSecret = secret) =>
    new SubjectKeyService({
      get: jest.fn().mockReturnValue(configuredSecret),
    } as unknown as ConfigService);

  it('creates a deterministic constant-size pseudonym', () => {
    const service = createService();

    const first = service.hash('auth-login', rawSubject);
    const second = service.hash('auth-login', rawSubject);

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain(rawSubject);
  });

  it('separates namespaces for the same raw subject', () => {
    const service = createService();

    expect(service.hash('auth-login', rawSubject)).not.toBe(
      service.hash('upload', rawSubject),
    );
  });

  it('rejects a missing or weak secret without exposing the subject', () => {
    expect(() => createService('short')).toThrow(
      'Coordination key configuration is invalid.',
    );
    expect(() => createService('')).toThrow(
      'Coordination key configuration is invalid.',
    );
  });
});
