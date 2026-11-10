/**
 * Utilidades de administración (ejecutar en el servidor):
 *   docker compose exec api node src/cli.mjs reset-password <correo>     → genera una contraseña temporal
 *   docker compose exec api node src/cli.mjs list-users
 *   docker compose exec api node src/cli.mjs test-email <correo>          → prueba el SMTP y muestra el error exacto
 */
import { randomBytes } from 'node:crypto';
import { hashPassword } from './crypto.mjs';
import { pool } from './db.mjs';
import { revokeAllForUser } from './tokens.mjs';
import { config } from './config.mjs';
import { sendRecoveryCode } from './mail.mjs';

const [cmd, arg] = process.argv.slice(2);
try {
  if (cmd === 'reset-password' && arg) {
    const temp = `Tmp${randomBytes(6).toString('base64url')}9`;
    const { rows } = await pool.query('update auth.users set encrypted_password = $2, updated_at = now() where lower(email) = lower($1) returning id', [arg, await hashPassword(temp)]);
    if (!rows[0]) throw new Error('Usuario no encontrado');
    await revokeAllForUser(rows[0].id);
    console.log(`Contraseña temporal para ${arg}: ${temp}\nPídele que la cambie en Configuración → Seguridad.`);
  } else if (cmd === 'test-email' && arg) {
    if (!config.smtp) throw new Error('SMTP no configurado: falta SMTP_HOST en .env');
    const { host, port, user, from } = config.smtp;
    console.log(`SMTP: ${host}:${port} · usuario: ${user || '(sin usuario)'} · remitente: ${from}`);
    await sendRecoveryCode(arg, '123456');
    console.log(`✔ Correo de prueba enviado a ${arg} (código ficticio 123456). Revisa también spam.`);
  } else if (cmd === 'list-users') {
    const { rows } = await pool.query('select email, created_at, last_sign_in_at from auth.users order by created_at');
    console.table(rows);
  } else {
    console.log('Uso: node src/cli.mjs reset-password <correo> | list-users | test-email <correo>');
  }
} finally {
  await pool.end();
}
