# Servidor, despliegue y APK

## 1. Requisitos del servidor

- Linux (Ubuntu 22.04/24.04 o similar) con **Docker** y **Docker Compose v2**.
- 1 vCPU · 1–2 GB RAM · 20 GB disco son suficientes para dos personas.
- Puertos **80 y 443** abiertos.
- Un **dominio** (o subdominio) apuntando a la IP del servidor, p. ej. `finanzas.tu-dominio.com`.
  Sin dominio puedes usar `<ip-con-guiones>.sslip.io` (p. ej. `203-0-113-10.sslip.io`).
  > Android bloquea HTTP sin cifrar en apps instaladas: el APK necesita **HTTPS** (Caddy lo obtiene solo).

## 2. Instalar el backend

```bash
git clone https://github.com/eudysgarcia/OpTogether.git
cd OpTogether/server
cp .env.example .env
nano .env        # DOMAIN, PUBLIC_URL y los 4 secretos (openssl rand -base64 48)
docker compose up -d --build
docker compose logs migrate     # debe terminar en "Migraciones al día."
curl https://TU-DOMINIO/health  # {"ok":true}
```

Servicios: `db` (PostgreSQL 17 + pg_cron), `migrate` (aplica migraciones y sale), `rest` (PostgREST),
`api` (autenticación, comprobantes, push), `caddy` (HTTPS). La base de datos **no** se expone a Internet.

### Variables (`server/.env`)

| Variable | Descripción |
|---|---|
| `DOMAIN` | Dominio público (Caddy emite el certificado) |
| `PUBLIC_URL` | `https://` + dominio (para URLs firmadas de comprobantes) |
| `POSTGRES_PASSWORD`, `AUTHENTICATOR_PASSWORD`, `API_DB_PASSWORD` | Contraseñas de la base de datos |
| `JWT_SECRET` | Firma de sesiones (≥ 32 caracteres). Cambiarlo cierra todas las sesiones |
| `SIGNUP_ALLOWLIST` | Correos autorizados a registrarse (recomendado: los de Eudys y Mei) |
| `SMTP_*` | Opcional: correo para recuperar contraseña con código de 6 dígitos |
| `EXPO_ACCESS_TOKEN` | Opcional: si activas seguridad reforzada de Expo Push |

### Operación

```bash
docker compose ps                                   # estado
docker compose logs -f api                          # registros
git pull && docker compose up -d --build            # actualizar (aplica migraciones nuevas)
docker compose exec api node src/cli.mjs list-users
docker compose exec api node src/cli.mjs reset-password correo@ejemplo.com   # contraseña temporal sin SMTP
```

### Copias de seguridad

```bash
# Base de datos (diaria, p. ej. con cron del sistema)
docker compose exec -T db pg_dump -U postgres -Fc optogether > respaldo-$(date +%F).dump
# Comprobantes
docker run --rm -v optogether_receipts:/d -v "$PWD":/b alpine tar czf /b/comprobantes-$(date +%F).tgz -C /d .
# Restaurar la base
docker compose exec -T db pg_restore -U postgres -d optogether --clean < respaldo.dump
```

## 3. Conectar la app

- **APK ya instalado**: al abrirlo por primera vez aparece *“Conecta tu servidor”* → escribe `https://TU-DOMINIO`.
  La app comprueba `/health` y lo guarda.
- **Compilar con la dirección incluida** (no pide nada al abrir):
  ```bash
  npx eas-cli env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://TU-DOMINIO --visibility plaintext
  npx eas-cli build -p android --profile preview
  ```

## 4. Desarrollo local

```bash
cp server/.env.example server/.env    # DOMAIN=:80  HTTP_PORT=8088  PUBLIC_URL=http://localhost:8088 + secretos
npm run server:up
echo "EXPO_PUBLIC_API_URL=http://localhost:8088" > .env.local
npm run web
```

## 5. APK (EAS Build)

```bash
npx eas-cli build -p android --profile preview      # APK instalable
npx eas-cli update --channel preview --environment preview --message "..."   # cambios JS sin reinstalar
```
Instalar: abre el enlace del build en el teléfono → permite “Instalar apps desconocidas” → Instalar.

## 6. Notificaciones push (Android)

Funcionan sin configuración: bandeja dentro de la app y recordatorios locales del teléfono.
Para push remotas Expo exige Firebase Cloud Messaging:
1. Proyecto Firebase → app Android `com.eudysgarcia.optogether` → descarga `google-services.json` a la raíz (está en `.gitignore`).
2. `app.json` → `android.googleServicesFile: "./google-services.json"`.
3. `npx eas-cli credentials` → Android → Google Service Account → FCM V1. Recompila el APK.

## 7. Primer uso: Eudys y Mei

1. **Eudys**: *Crear cuenta* → *Crear nuestro hogar* (valores iniciales precargados y editables) → **Crear hogar**.
2. Más → Configuración → Miembros → **Invitar a Mei** → comparte el código de 8 caracteres.
3. **Mei**: *Crear cuenta* → *Tengo un código de invitación*.

## 8. Pruebas

```bash
npm test && npm run db:test && npm run test:integration && (cd server/api && npm test)
```
