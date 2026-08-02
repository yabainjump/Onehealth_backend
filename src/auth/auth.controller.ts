import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { RequestWithUser } from '../users/interfaces/request-with-user.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Créer un compte',
    description:
      "Crée un nouvel utilisateur, envoie l'e-mail de bienvenue et renvoie un accessToken JWT.",
  })
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @ApiOperation({
    summary: 'Se connecter',
    description:
      'Renvoie un accessToken JWT à utiliser dans le bouton « Authorize ».',
  })
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @ApiOperation({
    summary: "Se connecter / s'inscrire avec Google",
    description:
      "Vérifie l'ID token Google Identity Services et connecte ou crée le compte correspondant.",
  })
  @Post('google')
  loginWithGoogle(@Body() googleLoginDto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(googleLoginDto);
  }

  @ApiOperation({
    summary: 'Mot de passe oublié',
    description:
      'Envoie un e-mail contenant un lien de réinitialisation si le compte existe.',
  })
  @Post('forgot-password')
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @ApiOperation({
    summary: 'Réinitialiser le mot de passe',
    description:
      'Définit un nouveau mot de passe à partir du token reçu par e-mail.',
  })
  @Post('reset-password')
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "Profil de l'utilisateur connecté" })
  @ApiUnauthorizedResponse({ description: 'Jeton manquant ou invalide.' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: RequestWithUser) {
    return request.user;
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Se déconnecter' })
  @ApiUnauthorizedResponse({ description: 'Jeton manquant ou invalide.' })
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Req() request: RequestWithUser) {
    return this.authService.logout(request.user.id);
  }
}
