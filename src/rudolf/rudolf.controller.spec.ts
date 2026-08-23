import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import type { RequestWithUser } from '../users/interfaces/request-with-user.interface';
import { RudolfController } from './rudolf.controller';
import {
  RudolfConversationBusyException,
  RudolfService,
} from './rudolf.service';

describe('RudolfController streaming contention', () => {
  it('returns HTTP 409, Retry-After and conversation_busy before streaming starts', async () => {
    const streamMessage = jest
      .fn()
      .mockRejectedValue(new RudolfConversationBusyException(75));
    const service = {
      streamMessage,
    } as unknown as RudolfService;
    const controller = new RudolfController(service);
    const request = Object.assign(new EventEmitter(), {
      user: { id: 'user-id' },
    }) as unknown as RequestWithUser;
    const output: string[] = [];
    const headers = new Map<string, string>();
    const responseEmitter = new EventEmitter();
    const response = Object.assign(responseEmitter, {
      destroyed: false,
      writableEnded: false,
      headersSent: false,
      statusCode: 200,
      setHeader: jest.fn((name: string, value: string) => {
        headers.set(name, value);
      }),
      status: jest.fn(function (this: { statusCode: number }, status: number) {
        this.statusCode = status;
        return this;
      }),
      write: jest.fn(function (this: { headersSent: boolean }, value: string) {
        this.headersSent = true;
        output.push(value);
        return true;
      }),
      end: jest.fn(function (this: { writableEnded: boolean }) {
        this.writableEnded = true;
      }),
    }) as unknown as Response;

    await controller.streamMessage(
      request,
      'conversation-id',
      { message: 'Question One Health' },
      response,
    );

    expect(response.statusCode).toBe(409);
    expect(headers.get('Retry-After')).toBe('75');
    expect(JSON.parse(output.join(''))).toMatchObject({
      type: 'error',
      status: 409,
      code: 'conversation_busy',
    });
    expect(streamMessage).toHaveBeenCalledWith(
      'user-id',
      'conversation-id',
      { message: 'Question One Health' },
      expect.any(Function),
      expect.any(AbortSignal),
    );
  });
});
