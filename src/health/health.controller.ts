import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @ApiOperation({ summary: 'Vérifier que le service répond' })
  @ApiOkResponse({
    description: 'Le service est opérationnel.',
    schema: {
      example: { status: 'ok', timestamp: '2026-01-01T12:00:00.000Z' },
    },
  })
  @Get()
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
