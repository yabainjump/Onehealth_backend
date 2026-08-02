import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestWithUser } from '../users/interfaces/request-with-user.interface';
import { CertificationsService } from './certifications.service';
import { CreateCertificationRequestDto } from './dto/create-certification-request.dto';

@ApiTags('Certifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('certifications')
export class CertificationsController {
  constructor(private readonly certificationsService: CertificationsService) {}

  @ApiOperation({ summary: 'Soumettre une demande de certification de profil' })
  @Post()
  create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateCertificationRequestDto,
  ) {
    return this.certificationsService.create(req.user.id, dto);
  }

  @ApiOperation({ summary: 'Ma dernière demande de certification (statut)' })
  @Get('me')
  findMine(@Req() req: RequestWithUser) {
    return this.certificationsService.findMine(req.user.id);
  }
}
