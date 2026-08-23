import { Controller, Get, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({ summary: 'Vérifier que le service répond' })
  @ApiOkResponse({
    description: 'Le service est opérationnel.',
    schema: {
      example: { status: 'ok', timestamp: '2026-01-01T12:00:00.000Z' },
    },
  })
  @Get()
  getHealth() {
    return this.healthService.getLiveness();
  }

  @ApiOperation({ summary: 'Vérifier que le processus est vivant' })
  @ApiOkResponse({ description: 'La boucle HTTP du processus répond.' })
  @Get('live')
  getLiveness() {
    return this.healthService.getLiveness();
  }

  @ApiOperation({ summary: "Vérifier que l'instance peut recevoir du trafic" })
  @ApiResponse({
    status: 200,
    description: 'Les dépendances essentielles répondent.',
  })
  @ApiResponse({
    status: 503,
    description: "L'instance doit être retirée du trafic.",
  })
  @Get('ready')
  getReadiness(@Res({ passthrough: true }) response: Response) {
    const readiness = this.healthService.getReadiness();
    response.setHeader('Cache-Control', 'no-store');

    if (readiness.status === 'unavailable') {
      const retryAfter =
        this.configService.get<number>('readinessRetryAfterSeconds') ?? 5;
      response.status(503);
      response.setHeader('Retry-After', `${retryAfter}`);
    }

    return readiness;
  }
}
