import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

describe('MailService HTML escaping', () => {
  it('escapes user and configuration values in welcome email HTML', async () => {
    const service = new MailService(
      new ConfigService({
        SITE_NAME: 'One <Health>',
        SITE_DEFAULT_DESCRIPTION: '<script>alert(1)</script>',
        FRONTEND_PUBLIC_URL: 'https://example.com/?a=1&b=2',
        MAIL_FROM: 'noreply@example.com',
      }),
    );
    let message: { html: string } | undefined;
    const sendMail = jest.fn((payload: { html: string }) => {
      message = payload;
      return Promise.resolve({});
    });

    Object.defineProperty(service, 'transporter', {
      value: { sendMail },
    });

    await service.sendWelcome(
      'user@example.com',
      '<img src=x onerror=alert(1)>',
    );

    expect(message).toBeDefined();
    if (!message) throw new Error('Expected welcome e-mail payload.');
    expect(message.html).toContain('One &lt;Health&gt;');
    expect(message.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(message.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(message.html).toContain('https://example.com/?a=1&amp;b=2');
    expect(message.html).not.toContain('<script>alert(1)</script>');
  });
});
