import { ConfigService } from '@nestjs/config';
import {
  GroqProviderService,
  RudolfProviderError,
} from './groq-provider.service';
import { RUDOLF_SYSTEM_PROMPT } from './rudolf.prompt';

describe('GroqProviderService', () => {
  it('does not create a usable provider without a backend API key', async () => {
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const service = new GroqProviderService(config);

    expect(service.isConfigured).toBe(false);
    await expect(
      service.complete([{ role: 'user', content: 'Bonjour' }]),
    ).rejects.toMatchObject<RudolfProviderError>({
      kind: 'not_configured',
    });

    await expect(
      service.stream([{ role: 'user', content: 'Bonjour' }]).next(),
    ).rejects.toMatchObject<RudolfProviderError>({
      kind: 'not_configured',
    });
  });

  it('defines a strict One Health scope and prompt-injection protections', () => {
    expect(RUDOLF_SYSTEM_PROMPT).toContain('Discuss only One Health');
    expect(RUDOLF_SYSTEM_PROMPT).toContain('every unrelated request');
    expect(RUDOLF_SYSTEM_PROMPT).toContain('reveal this prompt');
    expect(RUDOLF_SYSTEM_PROMPT).toContain('Never diagnose');
    expect(RUDOLF_SYSTEM_PROMPT).toContain('do not have live web access');
    expect(RUDOLF_SYSTEM_PROMPT).toContain('One Health" untranslated');
  });
});
