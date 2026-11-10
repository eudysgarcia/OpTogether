import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { files } from './api';

export const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

export type PickedFile = { uri: string; name: string; mimeType: string; size: number };

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
 * Sube un comprobante al servidor (almacenamiento privado). El servidor valida el tipo real del
 * archivo, autoriza con las mismas reglas RLS del usuario y registra el comprobante.
 */
export async function uploadAttachment(opts: { householdId: string; transactionId: string; file: PickedFile; description?: string }) {
  const { householdId, transactionId, file, description } = opts;
  if (!ALLOWED.includes(file.mimeType)) throw new Error('Formato no permitido. Usa JPG, PNG, WEBP, HEIC o PDF.');
  const size = file.size || new File(file.uri).size || 0;
  if (size > MAX_BYTES) throw new Error('El archivo supera 15 MB.');
  const form = new FormData();
  form.append('householdId', householdId);
  form.append('transactionId', transactionId);
  if (description) form.append('description', description.slice(0, 200));
  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    form.append('file', new Blob([blob], { type: file.mimeType }), file.name);
  } else {
    // React Native: FormData acepta { uri, name, type } y transmite el archivo sin cargarlo en memoria.
    form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  }
  const r = await files.upload(form);
  return r.storage_path;
}

/** URL firmada de corta duración. Nunca se exponen URLs públicas. */
export async function signedUrl(path: string, seconds = 60) {
  return files.signedUrl(path, seconds);
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

/** Eliminación con motivo: queda auditada y el archivo se borra del servidor. */
export async function deleteAttachment(id: string, reason: string) {
  await files.remove(id, reason);
}
