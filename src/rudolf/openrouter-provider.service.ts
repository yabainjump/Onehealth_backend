import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, {
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  RateLimitError,
} from 'openai';
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions';
import { RUDOLF_SYSTEM_PROMPT } from './rudolf.prompt';

export type RudolfProviderMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type RudolfProviderErrorKind =
  | 'not_configured'
  | 'aborted'
  | 'timeout'
  | 'rate_limit'
  | 'insufficient_credit'
  | 'authentication'
  | 'unavailable';

export class RudolfProviderError extends Error {
  constructor(readonly kind: RudolfProviderErrorKind) {
    super(kind);
    this.name = 'RudolfProviderError';
  }
}

const PRIVACY_ROUTING = {
  provider: { data_collection: 'deny', zdr: true },
} as const;

@Injectable()
export class OpenRouterProviderService {
  private readonly logger = new Logger(OpenRouterProviderService.name);
  private readonly client: OpenAI | null;
  private readonly timeoutMs: number;
  readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY')?.trim();
    this.timeoutMs =
      this.configService.get<number>('OPENROUTER_TIMEOUT_MS') ?? 60_000;
    this.model =
      this.configService.get<string>('OPENROUTER_MODEL')?.trim() ||
      'meta-llama/llama-3.3-70b-instruct';

    this.client = apiKey
      ? new OpenAI({
          apiKey,
          baseURL: 'https://openrouter.ai/api/v1',
          timeout: this.timeoutMs,
          maxRetries: 0,
        })
      : null;
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  async complete(
    history: RudolfProviderMessage[],
    systemPrompt = RUDOLF_SYSTEM_PROMPT,
    signal?: AbortSignal,
  ): Promise<string> {
    const client = this.requireClient();
    const messages = this.buildMessages(history, systemPrompt);
    const deadline = AbortSignal.timeout(this.timeoutMs);
    const requestSignal = signal
      ? AbortSignal.any([signal, deadline])
      : deadline;

    try {
      const request: ChatCompletionCreateParamsNonStreaming &
        typeof PRIVACY_ROUTING = {
        model: this.model,
        messages,
        temperature: 0.2,
        max_completion_tokens: 900,
        top_p: 1,
        ...PRIVACY_ROUTING,
      };
      const completion = await client.chat.completions.create(request, {
        signal: requestSignal,
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new RudolfProviderError('unavailable');
      }

      return content.slice(0, 12_000);
    } catch (error) {
      if (deadline.aborted && !signal?.aborted)
        throw new RudolfProviderError('timeout');
      this.rethrowProviderError(error);
    }
  }

  async *stream(
    history: RudolfProviderMessage[],
    signal?: AbortSignal,
  ): AsyncGenerator<string, void, void> {
    const client = this.requireClient();
    const messages = this.buildMessages(history);
    const deadline = AbortSignal.timeout(this.timeoutMs);
    const requestSignal = signal
      ? AbortSignal.any([signal, deadline])
      : deadline;

    try {
      const request: ChatCompletionCreateParamsStreaming &
        typeof PRIVACY_ROUTING = {
        model: this.model,
        messages,
        temperature: 0.2,
        max_completion_tokens: 900,
        top_p: 1,
        stream: true,
        ...PRIVACY_ROUTING,
      };
      const stream = await client.chat.completions.create(request, {
        signal: requestSignal,
      });

      for await (const chunk of stream) {
        if (deadline.aborted) throw new RudolfProviderError('timeout');
        if (signal?.aborted) throw new RudolfProviderError('aborted');
        if ('error' in chunk) throw new RudolfProviderError('unavailable');
        const content = chunk.choices[0]?.delta?.content;
        if (content) yield content;
      }
    } catch (error) {
      if (deadline.aborted && !signal?.aborted)
        throw new RudolfProviderError('timeout');
      this.rethrowProviderError(error);
    }
  }

  private requireClient(): OpenAI {
    if (!this.client) throw new RudolfProviderError('not_configured');
    return this.client;
  }

  private buildMessages(
    history: RudolfProviderMessage[],
    systemPrompt = RUDOLF_SYSTEM_PROMPT,
  ): ChatCompletionMessageParam[] {
    return [
      { role: 'system', content: systemPrompt },
      ...history.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];
  }

  private rethrowProviderError(error: unknown): never {
    if (error instanceof RudolfProviderError) throw error;
    if (error instanceof APIUserAbortError) {
      throw new RudolfProviderError('aborted');
    }
    if (error instanceof APIConnectionTimeoutError) {
      throw new RudolfProviderError('timeout');
    }
    if (error instanceof RateLimitError) {
      throw new RudolfProviderError('rate_limit');
    }
    if (error instanceof AuthenticationError) {
      this.logger.error('OpenRouter rejected the configured API credential.');
      throw new RudolfProviderError('authentication');
    }

    const statusValue: unknown =
      error instanceof APIError ? error.status : undefined;
    const status = typeof statusValue === 'number' ? statusValue : undefined;
    if (status === 402) {
      throw new RudolfProviderError('insufficient_credit');
    }
    if (status === 429) {
      throw new RudolfProviderError('rate_limit');
    }
    this.logger.error(
      `OpenRouter request failed${status ? ` with status ${status}` : ''}.`,
    );
    throw new RudolfProviderError('unavailable');
  }
}
