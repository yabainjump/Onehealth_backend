/**
 * Apercu de l'e-mail de bienvenue : l'envoie reellement a une adresse de test
 * (reutilise MailService.sendWelcome, donc rendu 100% identique au vrai mail).
 *
 *   npm run preview:welcome -- toi@exemple.com
 *   (ou via la variable WELCOME_TO)
 */
import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { MailService } from '../src/mail/mail.service';

async function main(): Promise<void> {
  const to = (process.argv[2] ?? process.env.WELCOME_TO ?? '').trim();
  if (!to) {
    throw new Error(
      'Usage : npm run preview:welcome -- destinataire@exemple.com',
    );
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const mail = app.get(MailService, { strict: false });
    if (!mail.isConfigured) {
      throw new Error('SMTP non configure (SMTP_HOST / SMTP_USER / SMTP_PASS).');
    }
    const ok = await mail.sendWelcome(to, 'Dr Exemple');
    console.log(
      ok
        ? `E-mail de bienvenue envoye a ${to}. Verifie ta boite (et les spams).`
        : `Echec de l'envoi a ${to}.`,
    );
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(
      'Apercu echoue :',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  });
