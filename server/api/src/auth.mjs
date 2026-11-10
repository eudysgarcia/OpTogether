import { config } from './config.mjs';
import { hashPassword, isEmail, passwordProblem, sha256, sixDigitCode, verifyPassword, safeEqual } from './crypto.mjs';
import { pool } from './db.mjs';
import { mailEnabled, sendRecoveryCode } from './mail.mjs';
import { issueSession, revokeAllForUser, verifyAccess } from './tokens.mjs';

/** Errores con el mismo texto que maneja la app (src/lib/errors.ts). */
const fail = (reply, status, message) => reply.code(status).send({ error: message, message });

/** Middleware: exige un JWT de acceso válido. */
export async function requireUser(req, reply) {
  const h = req.headers.authorization ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  try {
    req.user = await verifyAccess(token);
  } catch {
    return fail(reply, 401, 'SIN_SESION');
  }
}

export async function authRoutes(app) {
  const limited = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  app.post('/auth/signup', limited, async (req, reply) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = req.body?.password;
    if (!isEmail(email)) return fail(reply, 400, 'Correo no válido');
    const problem = passwordProblem(password);
    if (problem) return fail(reply, 400, problem);
    if (config.signupAllowlist.length && !config.signupAllowlist.includes(email)) {
      return fail(reply, 403, 'Este correo no está autorizado para crear cuenta en este servidor.');
    }
    const client = await pool.connect();
    try {
      await client.query('begin');
      const exists = await client.query('select 1 from auth.users where lower(email) = $1', [email]);
      if (exists.rowCount) {
        await client.query('rollback');
        return fail(reply, 409, 'User already registered');
      }
      const { rows } = await client.query(
        `insert into auth.users (email, encrypted_password, email_confirmed_at, last_sign_in_at)
         values ($1, $2, now(), now()) returning id, email`,
        [email, await hashPassword(password)],
      );
      const session = await issueSession(client, rows[0]);
      await client.query('commit');
      return reply.code(201).send(session);
    } catch (e) {
      await client.query('rollback').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  });

  app.post('/auth/token', limited, async (req, reply) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const { rows } = await pool.query('select id, email, encrypted_password from auth.users where lower(email) = $1', [email]);
    const ok = await verifyPassword(password, rows[0]?.encrypted_password);
    if (!rows[0] || !ok) return fail(reply, 400, 'Invalid login credentials');
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('update auth.users set last_sign_in_at = now() where id = $1', [rows[0].id]);
      const session = await issueSession(client, rows[0]);
      await client.query('commit');
      return session;
    } catch (e) {
      await client.query('rollback').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  });

  /** Rotación de refresh token. Reutilizar un token ya rotado revoca todas las sesiones (robo de token). */
  app.post('/auth/refresh', limited, async (req, reply) => {
    const token = String(req.body?.refresh_token ?? '');
    if (!token) return fail(reply, 401, 'SIN_SESION');
    const client = await pool.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query(
        `select r.id, r.user_id, r.revoked_at, r.expires_at, u.email
           from auth.refresh_tokens r join auth.users u on u.id = r.user_id
          where r.token_hash = $1 for update of r`,
        [sha256(token)],
      );
      const r = rows[0];
      if (!r) {
        await client.query('rollback');
        return fail(reply, 401, 'SIN_SESION');
      }
      if (r.revoked_at) {
        await client.query('update auth.refresh_tokens set revoked_at = now() where user_id = $1 and revoked_at is null', [r.user_id]);
        await client.query('commit');
        return fail(reply, 401, 'SIN_SESION');
      }
      if (new Date(r.expires_at) < new Date()) {
        await client.query('rollback');
        return fail(reply, 401, 'SIN_SESION');
      }
      const session = await issueSession(client, { id: r.user_id, email: r.email }, r.id);
      await client.query('commit');
      return session;
    } catch (e) {
      await client.query('rollback').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  });

  app.post('/auth/logout', async (req) => {
    const token = String(req.body?.refresh_token ?? '');
    if (token) await pool.query('update auth.refresh_tokens set revoked_at = now() where token_hash = $1 and revoked_at is null', [sha256(token)]);
    return { ok: true };
  });

  app.get('/auth/user', { preHandler: requireUser }, async (req) => ({ user: req.user }));

  /** Cambio de contraseña: exige la contraseña actual y cierra las demás sesiones. */
  app.put('/auth/user', { preHandler: requireUser, ...limited }, async (req, reply) => {
    const { current_password: current, password } = req.body ?? {};
    const problem = passwordProblem(password);
    if (problem) return fail(reply, 400, problem);
    const { rows } = await pool.query('select encrypted_password from auth.users where id = $1', [req.user.id]);
    if (!(await verifyPassword(String(current ?? ''), rows[0]?.encrypted_password))) {
      return fail(reply, 400, 'La contraseña actual no es correcta.');
    }
    await pool.query('update auth.users set encrypted_password = $2, updated_at = now() where id = $1', [req.user.id, await hashPassword(password)]);
    await revokeAllForUser(req.user.id);
    const client = await pool.connect();
    try {
      return await issueSession(client, req.user);
    } finally {
      client.release();
    }
  });

  /** Recuperación: código de 6 dígitos por correo (15 min, 5 intentos). Respuesta neutra para no revelar cuentas. */
  app.post('/auth/recover', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (req, reply) => {
    if (!mailEnabled()) {
      return fail(reply, 501, 'La recuperación por correo no está configurada en el servidor. Pide al administrador que restablezca tu contraseña.');
    }
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const { rows } = await pool.query('select id, email from auth.users where lower(email) = $1', [email]);
    if (rows[0]) {
      const code = sixDigitCode();
      await pool.query(
        `insert into auth.recovery_codes (user_id, code_hash, expires_at) values ($1, $2, now() + interval '15 minutes')`,
        [rows[0].id, sha256(`${rows[0].id}:${code}`)],
      );
      try {
        await sendRecoveryCode(rows[0].email, code);
      } catch (e) {
        req.log.error(e, 'No se pudo enviar el correo de recuperación');
      }
    }
    return { ok: true };
  });

  app.post('/auth/reset', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const code = String(req.body?.code ?? '').trim();
    const problem = passwordProblem(req.body?.password);
    if (problem) return fail(reply, 400, problem);
    const invalid = () => fail(reply, 400, 'El código no es válido o expiró. Solicita uno nuevo.');
    const { rows: users } = await pool.query('select id, email from auth.users where lower(email) = $1', [email]);
    const user = users[0];
    if (!user || !/^\d{6}$/.test(code)) return invalid();
    const { rows } = await pool.query(
      `select id, code_hash, attempts from auth.recovery_codes
        where user_id = $1 and used_at is null and expires_at > now()
        order by created_at desc limit 1`,
      [user.id],
    );
    const rc = rows[0];
    if (!rc || rc.attempts >= 5) return invalid();
    if (!safeEqual(rc.code_hash, sha256(`${user.id}:${code}`))) {
      await pool.query('update auth.recovery_codes set attempts = attempts + 1 where id = $1', [rc.id]);
      return invalid();
    }
    await pool.query('update auth.recovery_codes set used_at = now() where id = $1', [rc.id]);
    await pool.query('update auth.users set encrypted_password = $2, updated_at = now() where id = $1', [user.id, await hashPassword(req.body.password)]);
    await revokeAllForUser(user.id);
    const client = await pool.connect();
    try {
      return await issueSession(client, user);
    } finally {
      client.release();
    }
  });
}
