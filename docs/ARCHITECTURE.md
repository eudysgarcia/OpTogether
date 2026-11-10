# Arquitectura

```
src/
  app/                    Rutas (Expo Router). Cada archivo es una pantalla.
    _layout.tsx           Proveedores + guardias: connect → (auth) → onboarding → (app)
    (auth)/               Inicio de sesión, registro, recuperación
    onboarding/           Crear hogar (asistente) o unirse con código
    (app)/(tabs)/         Inicio, Presupuesto, [+], Movimientos, Más
    (app)/...             Pagos, deudas, ahorros, fondos, aportaciones, calendario,
                          reportes, simulador, mi dinero, notificaciones, auditoría, configuración
  api/                    Hooks de datos (TanStack Query) por módulo
  domain/                 Lógica financiera PURA y probada (presupuesto, deudas, ahorros,
                          aportaciones, simulador, reportes)
  components/ui           Design system (Text, Button, Card, Inputs, Sheet, Select, Money, Progress…)
  components/finance      Componentes financieros (TxRow, BudgetRow, BillCycleRow, GoalCard…)
  components/charts       Gráficos SVG (donut, barras presupuesto vs real, tendencia)
  lib/                    Cliente del servidor (api.ts), sesión segura, errores, fechas, dinero, notificaciones, comprobantes, exportación
  store/                  Zustand persistido: preferencias, borradores, cola offline, escenarios
  theme/                  Tokens y ThemeProvider (claro/oscuro)
server/
  docker-compose.yml      PostgreSQL 17 + PostgREST + API (Node) + Caddy
  db/migrations/          Plataforma (roles, auth), esquema, lógica, RLS, cron, privilegios
  db/tests/               pgTAP
  api/src/                auth.mjs · files.mjs · push.mjs · migrate.mjs · cli.mjs
tests/integration/        Pruebas contra el backend real
```

## Backend autoalojado

```
App ──HTTPS──► Caddy ─┬─ /rest/*  ► PostgREST ─► PostgreSQL (RLS como el usuario del JWT)
                      ├─ /auth/*  ► API Node  ─► auth.users, refresh tokens, códigos
                      └─ /files/* ► API Node  ─► disco privado (autoriza vía RLS)
PostgreSQL ── pg_cron (recordatorios diarios) ── NOTIFY ─► API ─► Expo Push
```

- **Autenticación**: la API emite JWT HS256 (1 h, rol `authenticated`) y refresh tokens rotativos (60 días)
  guardados como hash; reutilizar uno ya rotado revoca todas las sesiones. La app guarda la sesión en
  el almacenamiento cifrado del teléfono (expo-secure-store).
- **Datos**: PostgREST valida el JWT y ejecuta cada consulta con el rol `authenticated` y
  `request.jwt.claims`; `auth.uid()` lee el `sub`. Toda la seguridad vive en la base de datos.
- **Comprobantes**: la API ejecuta `can_access_receipt_path()` como el usuario antes de guardar o
  firmar, valida el tipo real del archivo y sirve con URLs HMAC de corta duración.

## Principios

1. **Libro mayor único.** `transactions` es la única fuente de verdad de dinero. Saldos de fondos,
   ahorros, deudas, pagos de servicios y gasto real por categoría son **vistas derivadas**
   (`v_fund_balances`, `v_goal_balances`, `v_debts`, `v_bill_cycles`, `v_allocations`). No hay
   saldos almacenados que puedan contradecirse.
2. **Reglas en la base de datos.** Validaciones de ámbito, saldos no negativos, sobrepagos,
   inmutabilidad y anulación se aplican con triggers; la app no puede saltárselas.
3. **Atomicidad.** Cada operación financiera es una sola fila (o una función SQL transaccional
   como `move_budget`). Bloqueos `FOR UPDATE` serializan operaciones concurrentes sobre un mismo saldo.
4. **Idempotencia.** Cada movimiento lleva `client_request_id` único: reintentos y sincronización
   offline nunca duplican.
5. **Privacidad por diseño.** `scope = household | personal`; lo personal solo lo ve su dueño
   (RLS + vistas `security_invoker`).
6. **Nada silencioso.** Ajustes de presupuesto, traslados de sobrantes y anulaciones exigen motivo
   y quedan en `audit_logs` con valores anteriores y nuevos.

## Offline

- Caché de consultas persistida (7 días): se puede consultar lo ya sincronizado sin conexión.
- Borrador automático del formulario de movimiento.
- Gastos/ingresos simples (sin fondo ni comprobantes) se encolan sin conexión y se sincronizan al
  volver la red; los que dependen de saldos (fondos, ahorros, deudas) requieren conexión para no
  prometer operaciones que podrían fallar.

## Notificaciones

- `generate_notifications()` corre a diario con **pg_cron** (8:00 a. m. RD): recordatorios por
  servicio (10/5/1/0 días antes y después, configurable), cuotas de deudas y recordatorios
  manuales. Ciclos pagados o cancelados dejan de notificar.
- Alertas de presupuesto (85 % y excedido) por trigger al registrar gastos.
- Cada notificación se guarda (bandeja interna) y se publica con `NOTIFY`; la API la envía por **Expo Push**.
- Respaldo local: la app programa recordatorios en el teléfono para los próximos 30 días y los
  reprograma en cada sincronización.
