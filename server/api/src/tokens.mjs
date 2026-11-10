import { jwtVerify, SignJWT } from 'jose';
import { config } from './config.mjs';
import { randomToken, sha256 } from './crypto.mjs';
import { pool } from './db.mjs';

const key = new TextEncoder().encode(config.jwtSecret);

/** JWT de acceso que PostgREST acepta (rol `authenticated`, sub = id de usuario). */
export async function signAccess(user) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + config.accessTtlSeconds;
  const token = await new SignJWT({ role: 'authenticated', email: user.email, aud: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(key);
  return { token, exp };
}

export async function verifyAccess(token) {
  const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'], audience: 'authenticated' });
  if (payload.role !== 'authenticated' || !payload.sub) throw new Error('token inválido');
  return { id: payload.sub, email: payload.email };
}

/** Emite una sesión completa (acceso + refresh rotativo). */
export async function issueSession(client, user, replacingId = null) {
  const refresh = randomToken();
  const { rows } = await client.query(
    `insert into auth.refresh_tokens (user_id, token_hash, expires_at)
     values ($1, $2, now() + make_interval(days => $3)) returning id`,
    [user.id, sha256(refresh), config.refreshTtlDays],
  );
  if (replacingId) {
    await client.query('update auth.refresh_tokens set revoked_at = now(), replaced_by = $2 where id = $1', [replacingId, rows[0].id]);
  }
  const access = await signAccess(user);
  return {
    access_token: access.token,
    expires_at: access.exp,
    refresh_token: refresh,
    user: { id: user.id, email: user.email },
  };
}

export async function revokeAllForUser(userId) {
  await pool.query('update auth.refresh_tokens set revoked_at = now() where user_id = $1 and revoked_at is null', [userId]);
}
