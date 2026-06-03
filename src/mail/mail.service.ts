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
        text: this.buildResetEmailText(siteName, resetUrl, ttlMinutes),
        html: this.buildResetEmailHtml(siteName, resetUrl, ttlMinutes),
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

  private buildResetEmailText(
    siteName: string,
    resetUrl: string,
    ttlMinutes: number,
  ): string {
    return (
      `Vous avez demandé la réinitialisation de votre mot de passe sur ${siteName}.\n\n` +
      `Ouvrez ce lien (valable ${ttlMinutes} minutes) pour choisir un nouveau mot de passe :\n${resetUrl}\n\n` +
      `Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail : votre mot de passe restera inchangé.\n\n` +
      `— L'équipe ${siteName}`
    );
  }

  private buildResetEmailHtml(
    siteName: string,
    resetUrl: string,
    ttlMinutes: number,
  ): string {
    const accent = '#1f9d57';
    const year = new Date().getFullYear();

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${siteName}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f6;-webkit-font-smoothing:antialiased;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:${accent};padding:26px 32px;text-align:center;">
              <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.3px;">${siteName}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 14px;font-size:20px;color:#0f2f3d;">Réinitialisation du mot de passe</h1>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f4a57;">
                Tu as demandé à réinitialiser ton mot de passe sur <strong>${siteName}</strong>.
                Clique sur le bouton ci-dessous pour en choisir un nouveau.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px auto;">
                <tr>
                  <td align="center" style="border-radius:10px;background:${accent};">
                    <a href="${resetUrl}" target="_blank" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                      Réinitialiser mon mot de passe
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 10px;font-size:13px;color:#6b7280;">
                Ce lien est valable <strong>${ttlMinutes} minutes</strong>.
              </p>
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">
                Si le bouton ne fonctionne pas, copie-colle ce lien dans ton navigateur :
              </p>
              <p style="margin:0;font-size:13px;word-break:break-all;">
                <a href="${resetUrl}" target="_blank" style="color:${accent};">${resetUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #eef2f6;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                Si tu n'es pas à l'origine de cette demande, ignore simplement cet e-mail — ton mot de passe restera inchangé.
              </p>
              <p style="margin:10px 0 0;font-size:12px;color:#b6c0cc;">© ${year} ${siteName}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
