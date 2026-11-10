# Instalación, despliegue y APK

## 1. Backend (Supabase)

### Opción A — Supabase en la nube (recomendado para usar el APK)

1. Crea un proyecto en <https://supabase.com/dashboard> (región cercana, p. ej. `us-east-1`).
2. En tu terminal:
   ```bash
   npx supabase login                         # abre el navegador; una sola vez
   npx supabase link --project-ref <REF>      # REF = el id del proyecto (xxxx de xxxx.supabase.co)
   npx supabase db push                       # aplica las 3 migraciones (esquema, RLS, storage, cron)
   ```
3. En el dashboard del proyecto:
   - **Database → Extensions**: verifica que `pg_cron` y `pg_net` estén activas (la migración las crea).
   - **Authentication → URL Configuration**: `Site URL = optogether://` y agrega a *Redirect URLs*
     `optogether://**` (para confirmar correo y recuperar contraseña desde el teléfono).
   - **Authentication → Providers → Email**: deja *Confirm email* activado (recomendado).
   - **Storage**: el bucket `receipts` lo crea la migración como **privado**. No lo hagas público.
4. Copia de **Project Settings → API**: la *Project URL* y la clave *anon / publishable*.
   **Nunca** uses ni compartas la `service_role`.

### Opción B — Local (desarrollo)

```bash
npx supabase start
npx supabase status -o env   # API_URL y ANON_KEY → .env.local
```

## 2. Variables de entorno

| Variable | Dónde | Descripción |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `.env.local` / EAS env | URL del proyecto |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` / EAS env | Clave pública (anon) |

Para builds en EAS:
```bash
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://<REF>.supabase.co --visibility plaintext
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <ANON_KEY> --visibility plaintext
```
(repite con `--environment production` si haces builds de producción).

> Si un APK se compiló **sin** estas variables, al abrirlo muestra la pantalla **“Conecta tu servidor”**:
> pega allí la URL y la anon key una sola vez y queda guardado en el teléfono.

## 3. Ejecutar en desarrollo

```bash
npm install
npm run web                      # navegador
npx expo start                   # con un development build en el teléfono
npx eas-cli build -p android --profile development   # crea el development build (una vez)
```

## 4. APK (EAS Build)

```bash
npx eas-cli build -p android --profile preview       # genera un APK instalable
```
El enlace de descarga aparece al final y en <https://expo.dev/accounts/xeya/projects/optogether/builds>.

### Instalar el APK en Android
1. Abre el enlace del build en el teléfono y descarga el `.apk` (o escanea el QR de la página del build).
2. Android pedirá permitir “Instalar apps desconocidas” para el navegador → **Permitir**.
3. Abre el archivo y pulsa **Instalar**.

### Actualizaciones OTA
Cambios solo de JavaScript se pueden publicar sin reinstalar:
```bash
npx eas-cli update --channel preview --message "Descripción del cambio"
```

## 5. Notificaciones push (Android)

Las notificaciones **dentro de la app** y los **recordatorios locales** funcionan sin configuración.
Para push remotas en Android, Expo exige credenciales de Firebase Cloud Messaging:

1. Crea un proyecto en Firebase, agrega una app Android con el paquete `com.eudysgarcia.optogether`
   y descarga `google-services.json` a la raíz del proyecto (está en `.gitignore`).
2. Agrega a `app.json` → `android.googleServicesFile: "./google-services.json"`.
3. Sube la clave de cuenta de servicio FCM V1: `npx eas-cli credentials` → Android → *Google Service Account* → *FCM V1*.
4. Recompila el APK.

## 6. Primer uso: Eudys y Mei

1. **Eudys** instala la app → *Crear cuenta* → confirma el correo → inicia sesión.
2. *Crear nuestro hogar*: el asistente viene precargado con los ingresos (Eudys RD$42,550 · Mei RD$16,180),
   el presupuesto (RD$37,500), la distribución 25/75 y 50/50, y el ahorro conjunto (RD$1,000 + RD$1,000).
   Revisa/ajusta y pulsa **Crear hogar**. Todo se puede modificar después.
3. **Más → Configuración → Miembros → Invitar a Mei** → comparte el código de 8 caracteres.
4. **Mei** instala la app → *Crear cuenta* → *Tengo un código de invitación* → introduce el código.

## 7. Pruebas

```bash
npm test                  # unitarias + UI
npm run test:integration  # requiere `npx supabase start` y .env.local
npm run db:test           # pgTAP
npm run typecheck && npx eslint src tests
```
