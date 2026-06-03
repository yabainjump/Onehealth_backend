/**
 * Campagne e-mail : invite CHAQUE utilisateur a reinitialiser son mot de passe
 * (reprise d'activite + renforcement securite).
 *
 * Reutilise le vrai mecanisme de l'app (token aleatoire -> hash SHA-256 stocke
 * sur l'utilisateur + expiration), donc les liens fonctionnent avec la page
 * "reset-password" existante.
 *
 * ----------------------------------------------------------------------------
 *  SECURITE
 *  - DRY RUN par defaut : AUCUN e-mail envoye, AUCUNE ecriture en base.
 *    Pour envoyer reellement :  DRY_RUN=false
 *  - Reprend la ou il s'est arrete (journal scripts/.campaign-sent.log).
 *  - Throttling entre deux envois (CAMPAIGN_DELAY_MS) pour ne pas etre
 *    bloque par le SMTP / classe en spam.
 * ----------------------------------------------------------------------------
 *  EXEMPLES (a lancer sur le SERVEUR, ou avec les vraies variables de prod) :
 *    # 1) Apercu, aucun envoi :
 *    npm run campaign:reset
 *    # 2) Test reel sur UNE seule adresse :
 *    DRY_RUN=false CAMPAIGN_ONLY=toi@exemple.com npm run campaign:reset
 *    # 3) Envoi reel a TOUT le monde :
 *    DRY_RUN=false npm run campaign:reset
 * ----------------------------------------------------------------------------
 *  VARIABLES :
 *    DRY_RUN (def true) | CAMPAIGN_ONLY (email) | CAMPAIGN_LIMIT (n)
 *    CAMPAIGN_DELAY_MS (def 1500) | CAMPAIGN_RESET_TTL_MINUTES (def 10080 = 7 j)
 */
import 'reflect-metadata';
import 'dotenv/config';
import { appendFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createHash, randomBytes } from 'crypto';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import type { Model } from 'mongoose';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';
import { MailService } from '../src/mail/mail.service';
import { User } from '../src/users/schemas/user.schema';

const SENT_LOG = join(process.cwd(), 'scripts', '.campaign-sent.log');

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadSent(): Set<string> {
  if (!existsSync(SENT_LOG)) {
    return new Set<string>();
  }
  return new Set(
    readFileSync(SENT_LOG, 'utf8')
      .split('\n')
      .map((line) => line.trim().toLowerCase())
      .filter(Boolean),
  );
}

function buildResetUrl(config: ConfigService, rawToken: string): string {
  const configured = (
    config.get<string>('FRONTEND_RESET_PASSWORD_URL') ?? ''
  ).trim();
  const firstCors = (config.get<string>('CORS_ORIGIN') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .find(Boolean);
  const base =
    configured ||
    `${(firstCors ?? 'http://localhost:8100').replace(/\/+$/, '')}/reset-password`;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}token=${encodeURIComponent(rawToken)}`;
}

async function main(): Promise<void> {
  const dryRun = (process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false';
  const only = (process.env.CAMPAIGN_ONLY ?? '').trim().toLowerCase();
  const limit = Number(process.env.CAMPAIGN_LIMIT ?? 0) || 0;
  const delayMs = Number(process.env.CAMPAIGN_DELAY_MS ?? 1500);
  const ttlMinutes = Number(process.env.CAMPAIGN_RESET_TTL_MINUTES ?? 10080);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const usersService = app.get(UsersService, { strict: false });
    const mailService = app.get(MailService, { strict: false });
    const config = app.get(ConfigService, { strict: false });
    const userModel = app.get<Model<User>>(getModelToken(User.name), {
      strict: false,
    });

    if (!dryRun && !mailService.isConfigured) {
      throw new Error(
        'SMTP non configure (SMTP_HOST / SMTP_USER / SMTP_PASS). Abandon.',
      );
    }

    const filter = only ? { email: only } : {};
    const users = await userModel
      .find(filter, 'email firstName lastName')
      .lean()
      .exec();

    const sent = loadSent();
    let processed = 0;
    let sentCount = 0;
    let skipped = 0;
    let failed = 0;

    console.log(
      `\n=== Campagne reinitialisation de mot de passe ===\n` +
        `Mode       : ${dryRun ? 'DRY RUN (aucun envoi, aucune ecriture)' : 'LIVE (envoi reel)'}\n` +
        `Cible      : ${only || 'tous les utilisateurs'}\n` +
        `Total BDD  : ${users.length}\n` +
        `Deja faits : ${sent.size}\n` +
        `TTL lien   : ${ttlMinutes} min (${Math.round(ttlMinutes / 1440)} j)\n` +
        `Delai      : ${delayMs} ms entre 2 envois\n` +
        (limit ? `Limite     : ${limit}\n` : '') +
        `=================================================\n`,
    );

    for (const user of users) {
      if (limit && processed >= limit) {
        break;
      }
      const email = `${user.email ?? ''}`.trim().toLowerCase();
      if (!email) {
        skipped += 1;
        continue;
      }
      if (sent.has(email)) {
        skipped += 1;
        console.log(`SKIP (deja envoye) ${email}`);
        continue;
      }

      processed += 1;
      const name = [user.firstName, user.lastName]
        .map((part) => `${part ?? ''}`.trim())
        .filter(Boolean)
        .join(' ');

      if (dryRun) {
        console.log(`[DRY] enverrait a ${email} (${name || 'sans nom'})`);
        continue;
      }

      try {
        const rawToken = randomBytes(32).toString('hex');
        const tokenHash = createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

        await usersService.setPasswordResetTokenByEmail(
          email,
          tokenHash,
          expiresAt,
        );

        const resetUrl = buildResetUrl(config, rawToken);
        const ok = await mailService.sendPasswordResetCampaign(
          email,
          name,
          resetUrl,
        );

        if (ok) {
          sentCount += 1;
          appendFileSync(SENT_LOG, `${email}\n`);
          console.log(`OK   ${email}`);
        } else {
          failed += 1;
          console.log(`FAIL ${email} (envoi refuse par le SMTP)`);
        }
      } catch (error) {
        failed += 1;
        console.log(
          `FAIL ${email} : ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }

    console.log(
      `\n=== Termine ===\n` +
        `Traites : ${processed}\n` +
        `Envoyes : ${sentCount}\n` +
        `Ignores : ${skipped}\n` +
        `Echecs  : ${failed}\n` +
        (dryRun
          ? `\n(DRY RUN : relance avec DRY_RUN=false pour envoyer reellement.)\n`
          : ''),
    );
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(
      'Campagne echouee :',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  });
