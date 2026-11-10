// Escribe google-services.json desde la variable secreta GOOGLE_SERVICES_JSON_B64
// (EAS Build y CI). El archivo nunca se guarda en el repositorio.
import { existsSync, writeFileSync } from 'node:fs';

const b64 = process.env.GOOGLE_SERVICES_JSON_B64;
if (existsSync('google-services.json')) {
  console.log('google-services.json ya existe');
} else if (b64) {
  writeFileSync('google-services.json', Buffer.from(b64, 'base64'));
  console.log('google-services.json escrito desde GOOGLE_SERVICES_JSON_B64');
} else {
  console.warn('Aviso: falta GOOGLE_SERVICES_JSON_B64; el build no tendrá push remotas');
}
