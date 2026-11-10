import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.DATABASE_URL ??= 'postgres://x:y@localhost:1/z';
process.env.JWT_SECRET ??= 'x'.repeat(40);
process.env.PUBLIC_URL ??= 'https://ejemplo.test';
process.env.FILES_DIR ??= '/tmp/optogether-test';

const { hashPassword, verifyPassword, passwordProblem, isEmail } = await import('../src/crypto.mjs');
const { resolveStoragePath, sniffMime, signPath, verifySignature } = await import('../src/files.mjs');
const { signAccess, verifyAccess } = await import('../src/tokens.mjs');

const U = '11111111-2222-3333-4444-555555555555';

test('hash de contraseña con scrypt verifica y rechaza', async () => {
  const h = await hashPassword('Prueba1234');
  assert.match(h, /^scrypt\$/);
  assert.equal(await verifyPassword('Prueba1234', h), true);
  assert.equal(await verifyPassword('Otra12345', h), false);
  assert.equal(await verifyPassword('x', undefined), false);
});

test('reglas de contraseña y correo', () => {
  assert.ok(passwordProblem('corta1'));
  assert.ok(passwordProblem('soloLetras'));
  assert.equal(passwordProblem('Prueba1234'), null);
  assert.equal(isEmail('a@b.co'), true);
  assert.equal(isEmail('no-es-correo'), false);
});

test('rutas de comprobantes: impide path traversal', () => {
  assert.ok(resolveStoragePath(`${U}/${U}/${U}.png`));
  assert.equal(resolveStoragePath(`../${U}/${U}.png`), null);
  assert.equal(resolveStoragePath(`${U}/${U}/../../etc/passwd`), null);
  assert.equal(resolveStoragePath(`${U}/${U}/${U}.exe`), null);
});

test('detección de tipo real de archivo', () => {
  assert.equal(sniffMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(sniffMime(Buffer.from('%PDF-1.7')), 'application/pdf');
  assert.equal(sniffMime(Buffer.from('<html>')), null);
});

test('URL firmada: válida, alterada y expirada', () => {
  const p = `${U}/${U}/${U}.pdf`;
  const url = new URL(signPath(p, 60));
  assert.equal(verifySignature(p, url.searchParams.get('exp'), url.searchParams.get('sig')), true);
  assert.equal(verifySignature(p, url.searchParams.get('exp'), 'x'), false);
  assert.equal(verifySignature(`${U}/${U}/${U}.png`, url.searchParams.get('exp'), url.searchParams.get('sig')), false);
  assert.equal(verifySignature(p, String(Math.floor(Date.now() / 1000) - 1), url.searchParams.get('sig')), false);
});

test('JWT de acceso compatible con PostgREST', async () => {
  const { token } = await signAccess({ id: U, email: 'a@b.co' });
  const u = await verifyAccess(token);
  assert.equal(u.id, U);
  const [h, b] = token.split('.');
  await assert.rejects(() => verifyAccess(`${h}.${b}.firmaFalsa`));
});
