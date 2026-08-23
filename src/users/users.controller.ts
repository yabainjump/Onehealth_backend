import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
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
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import type { RequestWithUser } from './interfaces/request-with-user.interface';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { UserRole } from './schemas/user.schema';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Mon profil (utilisateur connecté)' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getCurrentUser(@Req() request: RequestWithUser) {
    return request.user;
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Mettre à jour mon profil' })
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateCurrentUser(
    @Req() request: RequestWithUser,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.usersService.updateById(request.user.id, dto);
    if (!user) {
      return request.user;
    }
    return this.usersService.toPublicUser(user, request.user.id);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Lister / rechercher des utilisateurs',
    description:
      'Recherche optionnelle par nom, prénom, username ou institution.',
  })
  @UseGuards(JwtAuthGuard)
  @Get()
  listUsers(@Req() request: RequestWithUser, @Query() query: ListUsersDto) {
    return this.usersService.listUsers(query.search, request.user.id);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Suggestions « qui suivre »',
    description:
      'Comptes qui publient le plus (triés par nombre de publications), hors soi-même et comptes déjà suivis.',
  })
  @UseGuards(JwtAuthGuard)
  @Get('suggestions')
  getSuggestions(
    @Req() request: RequestWithUser,
    @Query('limit') limit?: string,
  ) {
    const parsed = parseInt(`${limit ?? ''}`, 10);
    const safeLimit = Number.isFinite(parsed) ? parsed : 5;
    return this.usersService.getSuggestions(request.user.id, safeLimit);
  }

  @ApiOperation({ summary: 'Récupérer un profil par son id — public' })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async getById(
    @Req() request: RequestWithUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.usersService.toPublicUser(user, request.user?.id ?? '');
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Mettre à jour un utilisateur',
    description: 'Réservé au propriétaire du compte ou à un administrateur.',
  })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateById(
    @Req() request: RequestWithUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateProfileDto,
  ) {
    const isSelf = request.user.id === id;
    const isAdmin = request.user.role === UserRole.ADMIN;
    if (!isSelf && !isAdmin) {
      throw new ForbiddenException('You cannot update this user');
    }

    const user = await this.usersService.updateById(id, dto);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.usersService.toPublicUser(user, request.user.id);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Suivre un utilisateur' })
  @ApiParam({
    name: 'id',
    description: "Identifiant de l'utilisateur à suivre",
  })
  @UseGuards(JwtAuthGuard)
  @Post(':id/follow')
  followUser(
    @Req() request: RequestWithUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.usersService.followUser(request.user.id, id);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Ne plus suivre un utilisateur' })
  @ApiParam({
    name: 'id',
    description: "Identifiant de l'utilisateur à ne plus suivre",
  })
  @UseGuards(JwtAuthGuard)
  @Delete(':id/follow')
  unfollowUser(
    @Req() request: RequestWithUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.usersService.unfollowUser(request.user.id, id);
  }
}
