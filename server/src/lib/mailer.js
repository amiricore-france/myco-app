import nodemailer from 'nodemailer';

/**
 * Transport SMTP configuré via variables d'environnement :
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE (true/false)
 *   MAIL_FROM        → adresse d'expédition (ex. "Myco <no-reply@mon-domaine.fr>")
 *   APP_URL          → URL publique de l'app (pour construire les liens)
 *
 * Si SMTP n'est pas configuré, les e-mails ne sont pas envoyés : le lien est
 * journalisé dans la console (pratique en dev / avant config SMTP sur OVH).
 */

let transporter = null;
const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_PORT);

if (smtpConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: (process.env.SMTP_USER && process.env.SMTP_PASS)
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  });
}

export function isMailerConfigured() {
  return smtpConfigured;
}

export function appUrl() {
  return (process.env.APP_URL || process.env.CLIENT_URL || 'http://localhost:5273')
    .split(',')[0].trim().replace(/\/$/, '');
}

export async function sendMail({ to, subject, html, text }) {
  if (!smtpConfigured) {
    console.log(`[mailer] SMTP non configuré — e-mail non envoyé à ${to}`);
    console.log(`[mailer] Sujet : ${subject}`);
    if (text) console.log(`[mailer] Contenu :\n${text}`);
    return { sent: false };
  }
  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'Myco <no-reply@localhost>',
    to, subject, html, text
  });
  return { sent: true };
}

export async function sendVerificationEmail(to, token) {
  const link = `${appUrl()}/verifier-email?token=${encodeURIComponent(token)}`;
  const text = `Bienvenue sur Myco !\n\nConfirmez votre adresse e-mail en ouvrant ce lien :\n${link}\n\nSi vous n'êtes pas à l'origine de cette inscription, ignorez ce message.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#16a34a">Bienvenue sur Myco 🍄</h2>
      <p>Confirmez votre adresse e-mail pour activer votre compte :</p>
      <p><a href="${link}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Confirmer mon e-mail</a></p>
      <p style="color:#777;font-size:13px">Ou copiez ce lien : ${link}</p>
      <p style="color:#777;font-size:13px">Si vous n'êtes pas à l'origine de cette inscription, ignorez ce message.</p>
    </div>`;
  return sendMail({ to, subject: 'Confirmez votre e-mail — Myco', html, text });
}

export async function sendResetEmail(to, token) {
  const link = `${appUrl()}/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`;
  const text = `Réinitialisation de votre mot de passe Myco.\n\nOuvrez ce lien (valable 1 heure) :\n${link}\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez ce message.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#16a34a">Réinitialisation de mot de passe</h2>
      <p>Vous avez demandé à réinitialiser votre mot de passe Myco. Ce lien est valable 1 heure :</p>
      <p><a href="${link}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Choisir un nouveau mot de passe</a></p>
      <p style="color:#777;font-size:13px">Ou copiez ce lien : ${link}</p>
      <p style="color:#777;font-size:13px">Si vous n'avez pas fait cette demande, ignorez ce message : votre mot de passe reste inchangé.</p>
    </div>`;
  return sendMail({ to, subject: 'Réinitialiser votre mot de passe — Myco', html, text });
}
