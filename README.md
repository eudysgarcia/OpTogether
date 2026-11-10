# OpTogether

> Construyendo nuestro futuro, juntos.

Aplicación móvil privada de finanzas del hogar para **Eudys y Mei**: presupuesto, gastos, aportaciones, pagos de servicios, vencimientos, fondos y caja chica, deudas y abonos, ahorros compartidos y personales, finanzas personales privadas, comprobantes, reportes, calendario, notificaciones y simulador. Moneda **DOP (RD$)**, español (RD).

| | |
|---|---|
| App | React Native · Expo SDK 58 · Expo Router · TypeScript |
| Estado | TanStack Query (caché persistente offline) · Zustand (preferencias, borradores, cola offline) |
| UI | Design system propio (tokens), Reanimated, SVG, Lucide |
| Backend (autoalojado) | **PostgreSQL 17** (RLS, pg_cron) · **PostgREST** · **API Node** (auth JWT, comprobantes, push) · **Caddy** (HTTPS) |
| Distribución | EAS Build (APK `preview`), EAS Update |

## Estructura

```
src/            App móvil
server/
  docker-compose.yml   Postgres + PostgREST + API + Caddy
  db/migrations/       Esquema, reglas contables, RLS, auditoría, cron
  db/tests/            Pruebas pgTAP
  api/                 Autenticación, comprobantes, push, migraciones
tests/integration/     Pruebas contra el backend real
docs/                  Arquitectura, base de datos, despliegue, diseño
```

## Inicio rápido (desarrollo)

```bash
npm install
cp server/.env.example server/.env      # completa secretos (ver docs/DEPLOY.md)
npm run server:up                        # PostgreSQL + PostgREST + API + Caddy en Docker
echo "EXPO_PUBLIC_API_URL=http://localhost:8088" > .env.local
npm run web                              # o npx expo start con un development build
```

## Pruebas

```bash
npm test                    # app: cálculos financieros + interfaz (34)
npm run db:test             # pgTAP: reglas contables, RLS, privacidad, endurecimiento (88)
npm run test:integration    # API real: datos, privacidad, comprobantes, autenticación (16)
(cd server/api && npm test) # API: contraseñas, JWT, URLs firmadas, rutas seguras (6)
```

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md)
- [Base de datos y reglas contables](docs/DATABASE.md)
- [Servidor, despliegue y APK](docs/DEPLOY.md)
- [Sistema de diseño](docs/DESIGN.md)

## Seguridad

- Sin secretos en el repositorio: todo va en `server/.env` (ignorado por git).
- La autorización la aplica PostgreSQL con **Row Level Security**; PostgREST y la API actúan como el usuario autenticado.
- Las finanzas personales solo las ve su dueño (también en auditoría, notificaciones, exportaciones y comprobantes).
- Comprobantes en disco privado del servidor, servidos solo con URLs firmadas (HMAC, 2 min) y validación del tipo real del archivo.
- Contraseñas con scrypt; refresh tokens rotativos con detección de reutilización; límites de intentos.
- Ningún registro financiero se borra: se **anula** con motivo y queda en auditoría.
