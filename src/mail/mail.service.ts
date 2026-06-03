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

  /**
   * E-mail de campagne : invite l'utilisateur a reinitialiser son mot de passe
   * (reprise d'activite + renforcement securite). Texte fourni par l'equipe.
   */
  async sendPasswordResetCampaign(
    to: string,
    displayName: string,
    resetUrl: string,
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
        subject: `Réinitialisation sécurisée de votre mot de passe – ${siteName}`,
        text: this.buildCampaignText(siteName, displayName, resetUrl),
        html: this.buildCampaignHtml(siteName, displayName, resetUrl),
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send reset campaign email to ${to}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }

  private buildCampaignText(
    siteName: string,
    displayName: string,
    resetUrl: string,
  ): string {
    const hello = displayName ? `Bonjour ${displayName},` : 'Bonjour,';
    return (
      `${hello}\n\n` +
      `Nous vous informons que la plateforme ${siteName} reprend progressivement ses activités après une période de pause liée à des ajustements techniques.\n\n` +
      `Dans le cadre du renforcement de la sécurité de la plateforme, nous avons procédé à une mise à jour du système d'accès. Pour garantir une connexion sécurisée, chaque utilisateur est invité à réinitialiser son mot de passe avant de se reconnecter à son compte.\n\n` +
      `Réinitialisez votre mot de passe via ce lien :\n${resetUrl}\n\n` +
      `Pour votre sécurité, ne partagez jamais votre mot de passe avec une autre personne.\n\n` +
      `Nous vous remercions pour votre compréhension et votre collaboration.\n\n` +
      `Cordialement,\nL'équipe ${siteName}`
    );
  }

  private buildCampaignHtml(
    siteName: string,
    displayName: string,
    resetUrl: string,
  ): string {
    const accent = '#1f9d57';
    const year = new Date().getFullYear();
    const hello = displayName ? `Bonjour ${displayName},` : 'Bonjour,';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${siteName}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f6;-webkit-font-smoothing:antialiased;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:${accent};padding:26px 32px;text-align:center;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.3px;">${siteName}</span>
        </td></tr>
        <tr><td style="padding:32px;color:#3f4a57;font-size:15px;line-height:1.6;">
          <h1 style="margin:0 0 16px;font-size:20px;color:#0f2f3d;">Réinitialisation sécurisée de votre mot de passe</h1>
          <p style="margin:0 0 14px;">${hello}</p>
          <p style="margin:0 0 14px;">Nous vous informons que la plateforme <strong>${siteName}</strong> reprend progressivement ses activités après une période de pause liée à des ajustements techniques.</p>
          <p style="margin:0 0 14px;">Dans le cadre du renforcement de la sécurité de la plateforme, nous avons procédé à une mise à jour du système d'accès. Pour garantir une connexion sécurisée, chaque utilisateur est invité à <strong>réinitialiser son mot de passe</strong> avant de se reconnecter à son compte.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
            <tr><td align="center" style="border-radius:10px;background:${accent};">
              <a href="${resetUrl}" target="_blank" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">Réinitialiser mon mot de passe</a>
            </td></tr>
          </table>
          <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
          <p style="margin:0 0 18px;font-size:13px;word-break:break-all;"><a href="${resetUrl}" target="_blank" style="color:${accent};">${resetUrl}</a></p>
          <p style="margin:0 0 14px;color:#6b7280;font-size:13px;">Pour votre sécurité, ne partagez jamais votre mot de passe avec une autre personne.</p>
          <p style="margin:0 0 14px;">Nous vous remercions pour votre compréhension et votre collaboration.</p>
          <p style="margin:0;">Cordialement,<br/>L'équipe ${siteName}</p>
        </td></tr>
        <tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #eef2f6;">
          <p style="margin:0;font-size:12px;color:#b6c0cc;">© ${year} ${siteName}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  /**
   * E-mail de bienvenue envoye a la creation du compte : presente la plateforme
   * et ce que l'utilisateur peut y faire.
   */
  async sendWelcome(to: string, displayName: string): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    const siteName = this.config('SITE_NAME') || 'One Health Network';
    const from = this.config('MAIL_FROM') || this.config('SMTP_USER');
    const appUrl = this.resolveAppUrl();
    const description =
      this.config('SITE_DEFAULT_DESCRIPTION') ||
      "One Health Network connecte les acteurs de la santé humaine, animale et environnementale pour collaborer, partager leurs travaux et coordonner la réponse aux enjeux sanitaires.";

    try {
      await this.transporter.sendMail({
        from: `"${siteName}" <${from}>`,
        to,
        subject: `Bienvenue sur ${siteName} 🎉`,
        text: this.buildWelcomeText(siteName, displayName, appUrl, description),
        html: this.buildWelcomeHtml(siteName, displayName, appUrl, description),
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send welcome email to ${to}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }

  private resolveAppUrl(): string {
    const direct = this.config('FRONTEND_PUBLIC_URL');
    if (direct) {
      return direct.replace(/\/+$/, '');
    }
    const firstCors = this.config('CORS_ORIGIN')
      .split(',')
      .map((origin) => origin.trim())
      .find(Boolean);
    return (firstCors ?? '').replace(/\/+$/, '');
  }

  private buildWelcomeText(
    siteName: string,
    displayName: string,
    appUrl: string,
    description: string,
  ): string {
    const hello = displayName ? `Bonjour ${displayName},` : 'Bonjour,';
    return (
      `${hello}\n\n` +
      `Bienvenue sur ${siteName} ! Votre compte vient d'être créé avec succès.\n\n` +
      `${description}\n\n` +
      `Ce que vous pouvez faire dès maintenant :\n` +
      `- Compléter votre profil professionnel (institution, spécialité, localisation, photo)\n` +
      `- Publier des actualités et échanger avec la communauté\n` +
      `- Découvrir et suivre d'autres experts en santé humaine, animale et environnementale\n` +
      `- Discuter en messagerie directe\n\n` +
      (appUrl ? `Accéder à la plateforme : ${appUrl}\n\n` : '') +
      `Au plaisir de vous retrouver,\nL'équipe ${siteName}`
    );
  }

  private buildWelcomeHtml(
    siteName: string,
    displayName: string,
    appUrl: string,
    description: string,
  ): string {
    const accent = '#1f9d57';
    const year = new Date().getFullYear();
    const hello = displayName ? `Bonjour ${displayName},` : 'Bonjour,';
    const cta = appUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
                <tr><td align="center" style="border-radius:10px;background:${accent};">
                  <a href="${appUrl}" target="_blank" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">Accéder à la plateforme</a>
                </td></tr>
              </table>`
      : '';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${siteName}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f6;-webkit-font-smoothing:antialiased;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:${accent};padding:26px 32px;text-align:center;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.3px;">${siteName}</span>
        </td></tr>
        <tr><td style="padding:32px;color:#3f4a57;font-size:15px;line-height:1.6;">
          <h1 style="margin:0 0 16px;font-size:21px;color:#0f2f3d;">Bienvenue sur ${siteName} ! 🎉</h1>
          <p style="margin:0 0 14px;">${hello}</p>
          <p style="margin:0 0 16px;">Votre compte vient d'être créé avec succès. Nous sommes ravis de vous compter parmi notre communauté.</p>
          <p style="margin:0 0 18px;padding:14px 16px;background:#f1f8f4;border-left:4px solid ${accent};border-radius:8px;color:#33474f;">${description}</p>
          <p style="margin:0 0 8px;font-weight:600;color:#0f2f3d;">Ce que vous pouvez faire dès maintenant :</p>
          <ul style="margin:0 0 8px;padding-left:20px;">
            <li style="margin-bottom:6px;">Compléter votre <strong>profil professionnel</strong> (institution, spécialité, localisation, photo)</li>
            <li style="margin-bottom:6px;">Publier des actualités et <strong>échanger</strong> avec la communauté</li>
            <li style="margin-bottom:6px;">Découvrir et suivre d'autres <strong>experts</strong> en santé humaine, animale et environnementale</li>
            <li style="margin-bottom:6px;">Discuter en <strong>messagerie directe</strong></li>
          </ul>
          ${cta}
          <p style="margin:16px 0 0;">Au plaisir de vous retrouver,<br/>L'équipe ${siteName}</p>
        </td></tr>
        <tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #eef2f6;">
          <p style="margin:0;font-size:12px;color:#b6c0cc;">© ${year} ${siteName}</p>
        </td></tr>
      </table>
    </td></tr>
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
