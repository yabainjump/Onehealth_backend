import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Envoi d'emails transactionnels via SMTP (nodemailer).
 *
 * Le service degrade proprement : si le SMTP n'est pas configure (variables
 * d'environnement absentes), aucun email n'est envoye et `sendPasswordReset`
 * renvoie `false` — le flux applicatif n'est jamais bloque.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;

  constructor(private readonly configService: ConfigService) {
    this.transporter = this.createTransporter();
  }

  get isConfigured(): boolean {
    return this.transporter !== null;
  }

  async sendPasswordReset(
    to: string,
    resetUrl: string,
    ttlMinutes: number,
  ): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    const siteName = this.config('SITE_NAME') || 'One Health Network';
    const from = this.config('MAIL_FROM') || this.config('SMTP_USER');

    try {
      await this.transporter.sendMail({
        from: `"${siteName}" <${from}>`,
        to,
        subject: `Réinitialisation de votre mot de passe — ${siteName}`,
        text:
          `Vous avez demandé la réinitialisation de votre mot de passe sur ${siteName}.\n\n` +
          `Ouvrez ce lien (valide ${ttlMinutes} minutes) pour choisir un nouveau mot de passe :\n${resetUrl}\n\n` +
          `Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.`,
        html:
          `<p>Vous avez demandé la réinitialisation de votre mot de passe sur <strong>${siteName}</strong>.</p>` +
          `<p><a href="${resetUrl}" style="display:inline-block;padding:10px 18px;background:#0b4ed6;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Réinitialiser mon mot de passe</a></p>` +
          `<p style="color:#555;font-size:13px">Ce lien est valable ${ttlMinutes} minutes. Si le bouton ne fonctionne pas, copiez ce lien :<br>${resetUrl}</p>` +
          `<p style="color:#777;font-size:12px">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${to}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }

  private createTransporter(): Transporter | null {
    const host = this.config('SMTP_HOST');
    const user = this.config('SMTP_USER');
    const pass = this.config('SMTP_PASS');

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing) — password reset emails will not be sent.',
      );
      return null;
    }

    const port = Number(this.configService.get<string>('SMTP_PORT') ?? 587);
    const secureSetting = this.config('SMTP_SECURE').toLowerCase();
    const secure = secureSetting === 'true' || port === 465;

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  private config(key: string): string {
    return `${this.configService.get<string>(key) ?? ''}`.trim();
  }
}
