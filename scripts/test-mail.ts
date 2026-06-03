/**
 * Diagnostic SMTP : verifie la connexion + envoie un email de test.
 *
 * Lancer :
 *   npm run test:mail -- destinataire@exemple.com
 * Sans argument, l'email part vers SMTP_USER (ta propre boite).
 *
 * Le script lit les memes variables que l'app (SMTP_HOST/PORT/SECURE/USER/PASS,
 * MAIL_FROM) depuis le .env, donc si ce test passe, l'app enverra aussi.
 */
import 'dotenv/config';
import nodemailer from 'nodemailer';

async function main(): Promise<void> {
  const host = (process.env.SMTP_HOST ?? '').trim();
  const user = (process.env.SMTP_USER ?? '').trim();
  const pass = (process.env.SMTP_PASS ?? '').trim();
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure =
    (process.env.SMTP_SECURE ?? '').toLowerCase() === 'true' || port === 465;
  const from = (process.env.MAIL_FROM ?? user).trim();
  const to = (process.argv[2] ?? process.env.TEST_MAIL_TO ?? user).trim();

  if (!host || !user || !pass) {
    throw new Error(
      'SMTP_HOST / SMTP_USER / SMTP_PASS manquant dans .env',
    );
  }

  console.log(`SMTP -> ${user}@${host}:${port} (secure=${secure})`);
  console.log(`Destinataire du test -> ${to}`);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  console.log('\n[1/2] Verification de la connexion + authentification...');
  await transporter.verify();
  console.log('      OK : le serveur accepte la connexion et le login.');

  console.log('[2/2] Envoi du mail de test...');
  const info = await transporter.sendMail({
    from: `"One Health Network (test)" <${from}>`,
    to,
    subject: 'Test SMTP — One Health Network',
    text: 'Si tu lis cet email, ta configuration SMTP fonctionne.',
    html: '<p>Si tu lis cet email, ta configuration SMTP fonctionne. ✅</p>',
  });

  console.log(`      OK : email envoye. messageId = ${info.messageId}`);
  if (info.accepted?.length) {
    console.log('      Accepte par le serveur pour :', info.accepted);
  }
  if (info.rejected?.length) {
    console.log('      Rejete pour :', info.rejected);
  }
  console.log('\nSucces. Verifie ta boite de reception (et le dossier spam).');
}

main()
  .then(() => process.exit(0))
  .catch((error: any) => {
    console.error('\nECHEC SMTP :');
    console.error('  message :', error?.message ?? error);
    if (error?.code) console.error('  code    :', error.code);
    if (error?.response) console.error('  reponse :', error.response);
    console.error(
      '\nPistes : mauvais host/port, SMTP_SECURE incorrect, mot de passe errone,\n' +
        'ou port 465/587 bloque par le pare-feu de la machine.',
    );
    process.exit(1);
  });
