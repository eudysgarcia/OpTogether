import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { supabase, unwrap } from './supabase';

export const BUCKET = 'receipts';
export const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

export type PickedFile = { uri: string; name: string; mimeType: string; size: number };

const extOf = (mime: string) =>
  ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'application/pdf': 'pdf' })[mime] ?? 'bin';

export async function pickFromCamera(): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Permite el acceso a la cámara para fotografiar comprobantes.');
  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  return { uri: a.uri, name: a.fileName ?? `foto-${Date.now()}.jpg`, mimeType: a.mimeType ?? 'image/jpeg', size: a.fileSize ?? 0 };
}

export async function pickFromLibrary(): Promise<PickedFile | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  return { uri: a.uri, name: a.fileName ?? `imagen-${Date.now()}.jpg`, mimeType: a.mimeType ?? 'image/jpeg', size: a.fileSize ?? 0 };
}

export async function pickDocument(): Promise<PickedFile | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  return { uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/pdf', size: a.size ?? 0 };
}

/**
 * Sube un comprobante al bucket PRIVADO y lo asocia al movimiento.
 * Si falla el registro en la tabla, elimina el archivo para no dejar huérfanos.
 */
export async function uploadAttachment(opts: { householdId: string; transactionId: string; file: PickedFile; description?: string }) {
  const { householdId, transactionId, file, description } = opts;
  if (!ALLOWED.includes(file.mimeType)) throw new Error('Formato no permitido. Usa JPG, PNG, WEBP, HEIC o PDF.');
  const body = await new File(file.uri).arrayBuffer();
  const size = body.byteLength || file.size;
  if (size > MAX_BYTES) throw new Error('El archivo supera 15 MB.');
  const path = `${householdId}/${transactionId}/${Crypto.randomUUID()}.${extOf(file.mimeType)}`;
  const up = await supabase.storage.from(BUCKET).upload(path, body, { contentType: file.mimeType, upsert: false });
  if (up.error) throw up.error;
  const ins = await supabase.from('transaction_attachments').insert({
    household_id: householdId,
    transaction_id: transactionId,
    storage_path: path,
    file_name: file.name.slice(0, 200),
    mime_type: file.mimeType,
    size_bytes: size,
    description: description?.slice(0, 200) || null,
  });
  if (ins.error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw ins.error;
  }
  return path;
}

/** URL firmada de corta duración (60 s). Nunca se exponen URLs públicas. */
export async function signedUrl(path: string, seconds = 60) {
  const r = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds);
  if (r.error) throw r.error;
  return r.data.signedUrl;
}

/** Descarga al almacenamiento temporal y abre el menú del sistema (guardar / compartir / abrir con). */
export async function downloadAndShare(path: string, fileName: string, mimeType: string) {
  const url = await signedUrl(path, 120);
  const dir = new Directory(Paths.cache, 'comprobantes');
  if (!dir.exists) dir.create();
  const target = new File(dir, `${Date.now()}-${fileName.replace(/[^\w.\-]+/g, '_')}`);
  const file = await File.downloadFileAsync(url, target);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName });
  return file.uri;
}

export async function deleteAttachment(id: string, reason: string) {
  const path = unwrap(await supabase.rpc('delete_attachment', { p_id: id, p_reason: reason })) as string;
  // El registro queda auditado (borrado lógico); el archivo se elimina del almacenamiento.
  await supabase.storage.from(BUCKET).remove([path]);
}
