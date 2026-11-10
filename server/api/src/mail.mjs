import nodemailer from 'nodemailer';
import { config } from './config.mjs';

let transport = null;
const getTransport = () => {
  if (!config.smtp) return null;
  transport ??= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465, // 465 = SSL directo; 587 = STARTTLS
    requireTLS: config.smtp.port === 587,
    connectionTimeout: 15000,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  return transport;
};

export const mailEnabled = () => !!config.smtp;

export async function sendRecoveryCode(to, code) {
  const t = getTransport();
  if (!t) throw new Error('SMTP no configurado');
  await t.sendMail({
    from: config.smtp.from,
    to,
    subject: 'Tu código para restablecer la contraseña · OpTogether',
    text: `Tu código es ${code}. Vence en 15 minutos.\n\nSi no lo solicitaste, ignora este correo.`,
    html: `<div style="font-family:Arial,sans-serif;color:#0E1538">
      <h2 style="color:#1F2C66">OpTogether</h2>
      <p>Tu código para restablecer la contraseña es:</p>
      <p style="font-size:30px;letter-spacing:8px;font-weight:bold;color:#1F2C66">${code}</p>
      <p>Vence en 15 minutos. Si no lo solicitaste, ignora este correo.</p></div>`,
  });
}
