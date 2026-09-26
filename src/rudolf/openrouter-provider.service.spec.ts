import { ConfigService } from '@nestjs/config';
import {
  OpenRouterProviderService,
  RudolfProviderError,
} from './openrouter-provider.service';
import { RUDOLF_SYSTEM_PROMPT } from './rudolf.prompt';

describe('OpenRouterProviderService', () => {
  const key = `sk-or-v1-${'a'.repeat(32)}`;
  const providerConfig = {
    get: jest.fn((name: string) =>
      name === 'OPENROUTER_API_KEY' ? key : undefined,
    ),
  } as unknown as ConfigService;

  afterEach(() => jest.restoreAllMocks());

  it('does not create a usable provider without a backend API key', async () => {
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const service = new OpenRouterProviderService(config);

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

  it('uses the fixed OpenRouter endpoint and privacy routing for a completion', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Une réponse.' } }],
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    );
    const service = new OpenRouterProviderService(providerConfig);

    await expect(
      service.complete([{ role: 'user', content: 'One Health ?' }]),
    ).resolves.toBe('Une réponse.');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(typeof init?.body).toBe('string');
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: 'meta-llama/llama-3.3-70b-instruct',
      provider: { data_collection: 'deny', zdr: true },
      max_completion_tokens: 900,
    });
    expect(body.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        { role: 'user', content: 'One Health ?' },
      ]),
    );
  });

  it('streams text and ignores OpenRouter SSE keepalive comments', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          ': OPENROUTER PROCESSING\n\ndata: {"choices":[{"delta":{"content":"Bonjour"}}]}\n\ndata: [DONE]\n\n',
          { headers: { 'content-type': 'text/event-stream' } },
        ),
      );
    const service = new OpenRouterProviderService(providerConfig);
    const chunks: string[] = [];
    for await (const chunk of service.stream([
      { role: 'user', content: 'One Health ?' },
    ])) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['Bonjour']);
    const requestBody = fetchMock.mock.calls[0][1]?.body;
    expect(typeof requestBody).toBe('string');
    expect(JSON.parse(requestBody as string)).toMatchObject({
      stream: true,
      provider: { data_collection: 'deny', zdr: true },
    });
  });

  it('maps provider throttling without exposing its response body', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'secret details' } }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const service = new OpenRouterProviderService(providerConfig);
    await expect(
      service.complete([{ role: 'user', content: 'Bonjour' }]),
    ).rejects.toMatchObject<RudolfProviderError>({ kind: 'rate_limit' });
  });

  it('distinguishes exhausted provider credits from rate limiting', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'private details' } }), {
        status: 402,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const service = new OpenRouterProviderService(providerConfig);
    await expect(
      service.complete([{ role: 'user', content: 'Bonjour' }]),
    ).rejects.toMatchObject<RudolfProviderError>({
      kind: 'insufficient_credit',
    });
  });
});
