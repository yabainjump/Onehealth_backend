import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { Connection, ConnectionStates } from 'mongoose';
import { resolveUploadsRoot } from '../config/uploads-path';
import { HUB_CONNECTION } from '../hub/hub.constants';
import { EssentialDependencyChecks, OptionalCapability } from './runtime.types';

@Injectable()
export class RuntimeDependencyProbeService {
  private readonly timeoutMs: number;

  constructor(
    @InjectConnection() private readonly primaryConnection: Connection,
    @InjectConnection(HUB_CONNECTION)
    private readonly hubConnection: Connection,
    private readonly configService: ConfigService,
  ) {
    this.timeoutMs =
      this.configService.get<number>('readinessProbeTimeoutMs') ?? 1_500;
  }

  async probeEssential(): Promise<EssentialDependencyChecks> {
    const [primaryDatabase, hubDatabase, mediaStorage] = await Promise.all([
      this.isDatabaseAvailable(this.primaryConnection),
      this.isDatabaseAvailable(this.hubConnection),
      this.isMediaStorageAvailable(),
    ]);

    return { primaryDatabase, hubDatabase, mediaStorage };
  }

  getDegradedCapabilities(): OptionalCapability[] {
    const degraded: OptionalCapability[] = [];
    if (!this.configService.get<string>('GROQ_API_KEY')?.trim()) {
      degraded.push('rudolf');
    }
    if (!this.configService.get<string>('SMTP_HOST')?.trim()) {
      degraded.push('email');
    }
    return degraded;
  }

  private async isDatabaseAvailable(
    connection: Connection,
  ): Promise<'up' | 'down'> {
    if (
      connection.readyState !== ConnectionStates.connected ||
      !connection.db
    ) {
      return 'down';
    }

    try {
      await this.withTimeout(connection.db.command({ ping: 1 }));
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async isMediaStorageAvailable(): Promise<'up' | 'down'> {
    try {
      await this.withTimeout(
        access(resolveUploadsRoot(), constants.R_OK | constants.W_OK),
      );
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async withTimeout<T>(operation: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Readiness probe timed out')),
        this.timeoutMs,
      );
      timer.unref();
    });

    try {
      return await Promise.race([operation, timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }
}
