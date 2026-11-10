import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { requireUser } from './auth.mjs';
import { config } from './config.mjs';
import { hmac, safeEqual } from './crypto.mjs';
import { asUser } from './db.mjs';

const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'application/pdf': 'pdf' };
const EXT_MIME = Object.fromEntries(Object.entries(MIME_EXT).map(([m, e]) => [e, m]));
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PATH_RE = new RegExp(`^(${UUID})/(${UUID})/(${UUID})\\.(jpg|png|webp|heic|pdf)$`);
const signingKey = hmac(config.jwtSecret, 'optogether-files-v1');

/** Ruta segura dentro de FILES_DIR (impide path traversal). */
export function resolveStoragePath(p) {
  if (!PATH_RE.test(p)) return null;
  const full = path.resolve(config.filesDir, p);
  return full.startsWith(path.resolve(config.filesDir) + path.sep) ? full : null;
}

/** Verifica que el contenido coincida con el tipo declarado (firmas de archivo). */
export function sniffMime(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp' && /^(heic|heix|mif1|msf1|hevc)/.test(buf.toString('ascii', 8, 12))) return 'image/heic';
  if (buf.length >= 5 && buf.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  return null;
}

export function signPath(p, ttlSeconds = 120) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = hmac(signingKey, `${p}|${exp}`);
  return `${config.publicUrl}/files/raw/${p}?exp=${exp}&sig=${sig}`;
}

export function verifySignature(p, exp, sig) {
  if (!/^\d+$/.test(String(exp)) || Number(exp) < Date.now() / 1000) return false;
  return safeEqual(hmac(signingKey, `${p}|${exp}`), sig);
}

export async function filesRoutes(app) {
  /** Subida: autoriza como el usuario (RLS), guarda en disco y registra el comprobante. */
  app.post('/files/upload', { preHandler: requireUser }, async (req, reply) => {
    const fields = {};
    let file = null;
    for await (const part of req.parts({ limits: { fileSize: config.maxUploadBytes, files: 1, fields: 5 } })) {
      if (part.type === 'file') {
        file = { buf: await part.toBuffer(), filename: part.filename, mimetype: part.mimetype };
      } else {
        fields[part.fieldname] = String(part.value ?? '');
      }
    }
    const { householdId, transactionId } = fields;
    if (!file || !new RegExp(`^${UUID}$`).test(householdId ?? '') || !new RegExp(`^${UUID}$`).test(transactionId ?? '')) {
      return reply.code(400).send({ message: 'Solicitud de subida incompleta.' });
    }
    const mime = sniffMime(file.buf);
    if (!mime || !MIME_EXT[file.mimetype] || (mime !== file.mimetype && !(mime.startsWith('image/') && file.mimetype.startsWith('image/')))) {
      return reply.code(415).send({ message: 'Formato no permitido. Usa JPG, PNG, WEBP, HEIC o PDF.' });
    }
    const rel = `${householdId}/${transactionId}/${randomUUID()}.${MIME_EXT[mime]}`;
    const full = resolveStoragePath(rel);
    const allowed = await asUser(req.user.id, async (c) => (await c.query('select public.can_access_receipt_path($1, true) as ok', [rel])).rows[0].ok);
    if (!allowed) return reply.code(403).send({ message: 'SIN_ACCESO' });
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, file.buf, { flag: 'wx' });
    try {
      const row = await asUser(req.user.id, async (c) =>
        (await c.query(
          `insert into public.transaction_attachments (household_id, transaction_id, storage_path, file_name, mime_type, size_bytes, description, uploaded_by)
           values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
          [householdId, transactionId, rel, String(file.filename || `comprobante.${MIME_EXT[mime]}`).slice(0, 200), mime, file.buf.length, fields.description?.slice(0, 200) || null, req.user.id],
        )).rows[0],
      );
      return reply.code(201).send({ id: row.id, storage_path: rel });
    } catch (e) {
      await unlink(full).catch(() => {});
      throw e;
    }
  });

  /** URL firmada de corta duración, solo si el usuario puede ver el comprobante (RLS). */
  app.get('/files/url', { preHandler: requireUser }, async (req, reply) => {
    const p = String(req.query?.path ?? '');
    if (!resolveStoragePath(p)) return reply.code(400).send({ message: 'Ruta inválida' });
    const visible = await asUser(req.user.id, async (c) =>
      (await c.query('select exists (select 1 from public.transaction_attachments where storage_path = $1) as ok', [p])).rows[0].ok,
    );
    if (!visible) return reply.code(403).send({ message: 'SIN_ACCESO' });
    return { url: signPath(p, Math.min(Number(req.query?.ttl ?? 120) || 120, 600)) };
  });

  app.get('/files/raw/*', async (req, reply) => {
    const p = req.params['*'];
    const full = resolveStoragePath(p);
    if (!full || !verifySignature(p, req.query?.exp, req.query?.sig)) return reply.code(403).send({ message: 'Enlace inválido o expirado' });
    try {
      await stat(full);
    } catch {
      return reply.code(404).send({ message: 'No encontrado' });
    }
    return reply
      .header('Content-Type', EXT_MIME[p.split('.').pop()] ?? 'application/octet-stream')
      .header('Cache-Control', 'private, no-store')
      .header('Content-Disposition', 'inline')
      .send(createReadStream(full));
  });

  /** Eliminación: el RPC valida autorización y deja auditoría; luego se borra el archivo. */
  app.post('/files/delete', { preHandler: requireUser }, async (req) => {
    const p = await asUser(req.user.id, async (c) =>
      (await c.query('select public.delete_attachment($1, $2) as path', [req.body?.id, String(req.body?.reason ?? '')])).rows[0].path,
    );
    const full = resolveStoragePath(p);
    if (full) await unlink(full).catch(() => {});
    return { ok: true };
  });
}
