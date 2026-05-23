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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestWithUser } from './interfaces/request-with-user.interface';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ListUsersDto } from './dto/list-users.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getCurrentUser(@Req() request: RequestWithUser) {
    return request.user;
  }

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

  @UseGuards(JwtAuthGuard)
  @Get()
  listUsers(@Req() request: RequestWithUser, @Query() query: ListUsersDto) {
    return this.usersService.listUsers(query.search, request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getById(@Req() request: RequestWithUser, @Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.usersService.toPublicUser(user, request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateById(
    @Req() request: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateProfileDto,
  ) {
    const isSelf = request.user.id === id;
    const isAdmin = request.user.role === 'admin';
    if (!isSelf && !isAdmin) {
      throw new ForbiddenException('You cannot update this user');
    }

    const user = await this.usersService.updateById(id, dto);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.usersService.toPublicUser(user, request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/follow')
  followUser(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.usersService.followUser(request.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/follow')
  unfollowUser(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.usersService.unfollowUser(request.user.id, id);
  }
}
