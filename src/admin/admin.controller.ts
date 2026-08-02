import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import type { RequestWithUser } from '../users/interfaces/request-with-user.interface';
import { AdminService } from './admin.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { SetBannedDto } from './dto/set-banned.dto';
import { RejectCertificationDto } from './dto/reject-certification.dto';
import { SetHiddenDto } from './dto/set-hidden.dto';
import { SetAlertVerificationDto } from './dto/set-alert-verification.dto';
import { SetHubAccessDto } from './dto/set-hub-access.dto';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @ApiOperation({ summary: "KPIs de la vue d'ensemble" })
  @Get('stats')
  stats() {
    return this.adminService.getStats();
  }

  @ApiOperation({
    summary: 'Liste paginée des utilisateurs (recherche/filtres)',
  })
  @Get('users')
  listUsers(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = parseInt(`${page ?? ''}`, 10);
    const parsedLimit = parseInt(`${limit ?? ''}`, 10);
    return this.adminService.listUsers({
      search,
      role,
      status,
      page: Number.isFinite(parsedPage) ? parsedPage : undefined,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
  }

  @ApiOperation({ summary: "Modifier le rôle d'un utilisateur" })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @Patch('users/:id/role')
  updateRole(
    @Req() req: RequestWithUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(id, dto.role, req.user.id);
  }

  @ApiOperation({
    summary: 'Configurer les rôles et pays autorisés dans le Hub',
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @Patch('users/:id/hub-access')
  setHubAccess(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SetHubAccessDto,
  ) {
    return this.adminService.setHubAccess(id, dto.roles, dto.countryCodes);
  }

  @ApiOperation({ summary: 'Suspendre / réactiver un compte' })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @Patch('users/:id/ban')
  setBanned(
    @Req() req: RequestWithUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SetBannedDto,
  ) {
    return this.adminService.setUserBanned(id, dto.banned, req.user.id);
  }

  @ApiOperation({ summary: 'Demandes de certification (pending par défaut)' })
  @Get('certifications')
  listCertifications(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = parseInt(`${page ?? ''}`, 10);
    const parsedLimit = parseInt(`${limit ?? ''}`, 10);
    return this.adminService.listCertificationRequests(
      status ?? 'pending',
      Number.isFinite(parsedPage) ? parsedPage : 1,
      Number.isFinite(parsedLimit) ? parsedLimit : 20,
    );
  }

  @ApiOperation({ summary: 'Approuver une demande de certification' })
  @ApiParam({ name: 'id', description: 'Identifiant de la demande' })
  @Patch('certifications/:id/approve')
  approveCertification(
    @Req() req: RequestWithUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.adminService.approveCertification(id, req.user.id);
  }

  @ApiOperation({
    summary: 'Refuser une demande de certification (avec motif)',
  })
  @ApiParam({ name: 'id', description: 'Identifiant de la demande' })
  @Patch('certifications/:id/reject')
  rejectCertification(
    @Req() req: RequestWithUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: RejectCertificationDto,
  ) {
    return this.adminService.rejectCertification(id, req.user.id, dto.reason);
  }

  @ApiOperation({ summary: 'Modération : liste paginée des posts (recherche)' })
  @Get('posts')
  listPosts(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = parseInt(`${page ?? ''}`, 10);
    const parsedLimit = parseInt(`${limit ?? ''}`, 10);
    return this.adminService.listPosts(
      search ?? '',
      Number.isFinite(parsedPage) ? parsedPage : 1,
      Number.isFinite(parsedLimit) ? parsedLimit : 20,
    );
  }

  @ApiOperation({ summary: 'Modération : mettre en pause / republier un post' })
  @ApiParam({ name: 'id', description: 'Identifiant du post' })
  @Patch('posts/:id/visibility')
  setPostHidden(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SetHiddenDto,
  ) {
    return this.adminService.setPostHidden(id, dto.hidden);
  }

  @ApiOperation({
    summary: 'Modération : liste paginée des alertes (recherche)',
  })
  @Get('alerts')
  listAlerts(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('verificationStatus') verificationStatus?: string,
  ) {
    const parsedPage = parseInt(`${page ?? ''}`, 10);
    const parsedLimit = parseInt(`${limit ?? ''}`, 10);
    return this.adminService.listAlerts(
      search ?? '',
      Number.isFinite(parsedPage) ? parsedPage : 1,
      Number.isFinite(parsedLimit) ? parsedLimit : 20,
      verificationStatus ?? '',
    );
  }

  @ApiOperation({
    summary: 'Modération : mettre en pause / republier une alerte',
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'alerte" })
  @Patch('alerts/:id/visibility')
  setAlertHidden(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SetHiddenDto,
  ) {
    return this.adminService.setAlertHidden(id, dto.hidden);
  }

  @ApiOperation({
    summary: 'Modération : vérifier, rejeter ou rouvrir une alerte',
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'alerte" })
  @Patch('alerts/:id/verification')
  setAlertVerification(
    @Req() req: RequestWithUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SetAlertVerificationDto,
  ) {
    return this.adminService.setAlertVerification(id, dto.status, req.user.id);
  }

  @ApiOperation({ summary: 'Modération : supprimer une publication' })
  @ApiParam({ name: 'id', description: 'Identifiant du post' })
  @Delete('posts/:id')
  removePost(@Param('id', ParseObjectIdPipe) id: string) {
    return this.adminService.removePost(id);
  }

  @ApiOperation({ summary: 'Modération : supprimer une alerte' })
  @ApiParam({ name: 'id', description: "Identifiant de l'alerte" })
  @Delete('alerts/:id')
  removeAlert(@Param('id', ParseObjectIdPipe) id: string) {
    return this.adminService.removeAlert(id);
  }
}
