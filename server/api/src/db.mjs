import pg from 'pg';
import { config } from './config.mjs';

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });

/**
 * Ejecuta `fn` como el usuario autenticado: rol `authenticated` + claims del JWT.
 * Así la API respeta exactamente las mismas políticas RLS que PostgREST.
 */
export async function asUser(userId, fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('set local role authenticated');
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: 'authenticated' }),
    ]);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
