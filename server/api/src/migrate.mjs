/**
 * Aplica las migraciones pendientes de ./migrations (o MIGRATIONS_DIR) en orden, cada una en
 * su propia transacción, y fija las contraseñas de los roles de servicio desde el entorno.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const url = process.env.ADMIN_DATABASE_URL;
if (!url) throw new Error('Falta ADMIN_DATABASE_URL');
const dir = process.env.MIGRATIONS_DIR ?? path.resolve('migrations');

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('select pg_advisory_lock(727272)');
  await client.query(`create schema if not exists ops;
    create table if not exists ops.schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
  const done = new Set((await client.query('select name from ops.schema_migrations')).rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = await readFile(path.join(dir, f), 'utf8');
    process.stdout.write(`Aplicando ${f}… `);
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into ops.schema_migrations (name) values ($1)', [f]);
      await client.query('commit');
      console.log('ok');
    } catch (e) {
      await client.query('rollback');
      console.error(`\nFalló ${f}: ${e.message}`);
      process.exitCode = 1;
      break;
    }
  }
  for (const [role, env] of [['authenticator', 'AUTHENTICATOR_PASSWORD'], ['api_service', 'API_DB_PASSWORD']]) {
    const pw = process.env[env];
    if (pw) await client.query(`alter role ${role} password ${client.escapeLiteral(pw)}`);
  }
  await client.query("notify pgrst, 'reload schema'");
  if (!process.exitCode) console.log('Migraciones al día.');
} finally {
  await client.end();
}
