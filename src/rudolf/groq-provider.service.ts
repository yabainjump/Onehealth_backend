import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq, {
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  RateLimitError,
} from 'groq-sdk';
import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';
import { RUDOLF_SYSTEM_PROMPT } from './rudolf.prompt';

export type RudolfProviderMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type RudolfProviderErrorKind =
  | 'not_configured'
  | 'timeout'
  | 'rate_limit'
  | 'authentication'
  | 'unavailable';

export class RudolfProviderError extends Error {
  constructor(readonly kind: RudolfProviderErrorKind) {
    super(kind);
    this.name = 'RudolfProviderError';
  }
}

@Injectable()
export class GroqProviderService {
  private readonly logger = new Logger(GroqProviderService.name);
  private readonly client: Groq | null;
  readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY')?.trim();
    const timeout = this.configService.get<number>('GROQ_TIMEOUT_MS') ?? 30_000;
    this.model =
      this.configService.get<string>('GROQ_MODEL')?.trim() ||
      'llama-3.3-70b-versatile';

    this.client = apiKey ? new Groq({ apiKey, timeout, maxRetries: 2 }) : null;
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  async complete(
    history: RudolfProviderMessage[],
    systemPrompt = RUDOLF_SYSTEM_PROMPT,
  ): Promise<string> {
    const client = this.requireClient();
    const messages = this.buildMessages(history, systemPrompt);

    try {
      const completion = await client.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.2,
        max_completion_tokens: 900,
        top_p: 1,
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new RudolfProviderError('unavailable');
      }

      return content.slice(0, 12_000);
    } catch (error) {
      this.rethrowProviderError(error);
    }
  }

  async *stream(
    history: RudolfProviderMessage[],
  ): AsyncGenerator<string, void, void> {
    const client = this.requireClient();
    const messages = this.buildMessages(history);

    try {
      const stream = await client.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.2,
        max_completion_tokens: 900,
        top_p: 1,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) yield content;
      }
    } catch (error) {
      this.rethrowProviderError(error);
    }
  }

  private requireClient(): Groq {
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
    if (error instanceof APIConnectionTimeoutError) {
      throw new RudolfProviderError('timeout');
    }
    if (error instanceof RateLimitError) {
      throw new RudolfProviderError('rate_limit');
    }
    if (error instanceof AuthenticationError) {
      this.logger.error('Groq rejected the configured API credential.');
      throw new RudolfProviderError('authentication');
    }

    const statusValue: unknown =
      error instanceof APIError ? error.status : undefined;
    const status = typeof statusValue === 'number' ? statusValue : undefined;
    this.logger.error(
      `Groq request failed${status ? ` with status ${status}` : ''}.`,
    );
    throw new RudolfProviderError('unavailable');
  }
}
