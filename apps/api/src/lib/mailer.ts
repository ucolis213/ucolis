// Envoi d'emails par Brevo. En développement sans clé, les emails sont écrits dans les logs.

import type { Logger } from 'pino';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export function createBrevoMailer(apiKey: string, sender = { name: 'UCOLIS', email: 'no-reply@ucolis.dz' }): Mailer {
  return {
    async send(mail) {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender,
          to: [{ email: mail.to }],
          subject: mail.subject,
          textContent: mail.text,
        }),
      });
      if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
    },
  };
}

export function createLogMailer(logger: Logger): Mailer {
  return {
    async send(mail) {
      logger.info({ to: mail.to, subject: mail.subject, text: mail.text }, 'email (non envoyé, mode développement)');
    },
  };
}

/** Mailer de test : garde les emails en mémoire. */
export function createMemoryMailer(): Mailer & { sent: Mail[]; last(to: string): Mail | undefined } {
  const sent: Mail[] = [];
  return {
    sent,
    async send(mail) {
      sent.push(mail);
    },
    last: (to) => [...sent].reverse().find((m) => m.to === to),
  };
}
