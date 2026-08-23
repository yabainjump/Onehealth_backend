import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';

const MIN_SECRET_BYTES = 32;
const MAX_NAMESPACE_LENGTH = 96;
const MAX_SUBJECT_LENGTH = 4_096;

@Injectable()
export class SubjectKeyService {
  private readonly secret: string;

  constructor(configService: ConfigService) {
    this.secret = configService.get<string>('rateLimitKeySecret')?.trim() ?? '';
    if (Buffer.byteLength(this.secret, 'utf8') < MIN_SECRET_BYTES) {
      throw new Error('Coordination key configuration is invalid.');
    }
  }

  hash(namespace: string, subject: string): string {
    if (
      !namespace ||
      namespace.length > MAX_NAMESPACE_LENGTH ||
      !subject ||
      subject.length > MAX_SUBJECT_LENGTH
    ) {
      throw new TypeError('Coordination key input is invalid.');
    }

    return createHmac('sha256', this.secret)
      .update(namespace, 'utf8')
      .update('\0', 'utf8')
      .update(subject, 'utf8')
      .digest('hex');
  }
}
