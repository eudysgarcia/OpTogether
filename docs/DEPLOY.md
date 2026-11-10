# Servidor, despliegue y APK

## 1. Requisitos del servidor

- Linux (Ubuntu 22.04/24.04 o similar) con **Docker** y **Docker Compose v2**.
- 1 vCPU · 1–2 GB RAM · 20 GB disco son suficientes para dos personas.
- Puertos **80 y 443** abiertos.
- Un **dominio** (o subdominio) apuntando a la IP del servidor, p. ej. `finanzas.tu-dominio.com`.
  Sin dominio puedes usar `<ip-con-guiones>.sslip.io` (p. ej. `203-0-113-10.sslip.io`).
  > Android bloquea HTTP sin cifrar en apps instaladas: el APK necesita **HTTPS** (Caddy lo obtiene solo).

## 2. Instalar el backend (servidor con Caddy y otros proyectos)

La pila **no** levanta su propio Caddy por defecto: PostgREST y la API se publican solo en
`127.0.0.1:8730` y `127.0.0.1:8731`, y tu Caddy existente los publica con HTTPS.
Todos los contenedores, redes y volúmenes llevan el prefijo `optogether` (no chocan con otros proyectos).
PostgreSQL no se expone fuera de Docker.

```bash
sudo mkdir -p /opt/optogether && sudo chown $USER /opt/optogether
git clone https://github.com/eudysgarcia/OpTogether.git /opt/optogether
cd /opt/optogether/server
cp .env.example .env && chmod 600 .env
nano .env                     # PUBLIC_URL, 4 secretos (openssl rand -hex 32), SIGNUP_ALLOWLIST
ss -ltn | grep -E ':(8730|8731) '   # si aparecen, cambia REST_PORT / API_PORT en .env
docker compose up -d --build
docker compose logs migrate   # debe terminar en "Migraciones al día."
curl http://127.0.0.1:8731/health    # {"ok":true}
```

Agrega el bloque de `server/caddy/optogether.caddy` a tu Caddyfile (cambia el dominio y, si
cambiaste puertos, ajústalos), valida y recarga sin cortar los otros sitios:

```bash
caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy           # Caddy instalado en el sistema
# o, si tu Caddy corre en Docker:  docker exec <contenedor-caddy> caddy reload --config /etc/caddy/Caddyfile
curl https://finanzas.tu-dominio.com/health
```

**Si tu Caddy corre en Docker**, no puede ver `127.0.0.1` del host. Conecta los contenedores a su red
y usa nombres de servicio en el bloque:

```bash
docker network connect <red-de-tu-caddy> optogether-rest-1
docker network connect <red-de-tu-caddy> optogether-api-1
# en el bloque: reverse_proxy optogether-rest-1:3000  y  reverse_proxy optogether-api-1:8080
```
(Para que sobreviva a recreaciones, agrega esa red como `external` en `docker-compose.yml`.)

Servidor **sin** proxy propio: `docker compose --profile caddy up -d --build` (usa `DOMAIN` del `.env`).

### Variables (`server/.env`)

| Variable | Descripción |
|---|---|
| `PUBLIC_URL` | `https://` + dominio público (para URLs firmadas de comprobantes) |
| `REST_PORT`, `API_PORT` | Puertos locales para tu Caddy (por defecto 8730 y 8731) |
| `DOMAIN` | Solo con `--profile caddy` |
| `POSTGRES_PASSWORD`, `AUTHENTICATOR_PASSWORD`, `API_DB_PASSWORD` | Contraseñas de la base de datos |
| `JWT_SECRET` | Firma de sesiones (≥ 32 caracteres). Cambiarlo cierra todas las sesiones |
| `SIGNUP_ALLOWLIST` | Correos autorizados a registrarse (recomendado: los de Eudys y Mei) |
| `SMTP_*` | Opcional: correo para recuperar contraseña con código de 6 dígitos |
| `EXPO_ACCESS_TOKEN` | Opcional: si activas seguridad reforzada de Expo Push |

### Operación

```bash
docker compose ps                                   # estado
docker compose logs -f api                          # registros
cd /opt/optogether && git pull && cd server && docker compose up -d --build   # actualizar (aplica migraciones nuevas)
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
