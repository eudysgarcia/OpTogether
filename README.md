# OpTogether

> Construyendo nuestro futuro, juntos.

Aplicación móvil privada de finanzas del hogar para **Eudys y Mei**: presupuesto, gastos, aportaciones, pagos de servicios, vencimientos, fondos y caja chica, deudas y abonos, ahorros compartidos y personales, finanzas personales privadas, comprobantes, reportes, calendario, notificaciones y simulador. Moneda inicial **DOP (RD$)**, idioma español (RD).

| | |
|---|---|
| App | React Native · Expo SDK 58 · Expo Router · TypeScript |
| Estado | TanStack Query (caché persistente offline) · Zustand (preferencias, borradores, cola offline) |
| Formularios | React Hook Form · Zod |
| UI | Design system propio (tokens), Reanimated, Gesture Handler, SVG, Lucide |
| Backend | Supabase: PostgreSQL + RLS, Auth, Storage privado, pg_cron, pg_net |
| Distribución | EAS Build (APK `preview`), EAS Update |

## Inicio rápido (desarrollo)

```bash
npm install
npx supabase start            # backend local en Docker (Postgres, Auth, Storage)
npx supabase status -o env    # copia API_URL y ANON_KEY a .env.local (ver .env.example)
npm run web                   # o: npx expo start  (Android requiere development build)
```

## Pruebas

```bash
npm test                      # unitarias: cálculos de presupuesto, deudas, ahorros, aportes, simulador, reportes
npm run test:integration      # integración contra Supabase local: gastos, pagos, abonos, fondos, comprobantes, privacidad
npm run db:test               # pgTAP: reglas contables, RLS, privacidad, auditoría y endurecimiento (87 pruebas)
npm run typecheck
```

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md)
- [Base de datos y reglas contables](docs/DATABASE.md)
- [Instalación, despliegue y APK](docs/DEPLOY.md)
- [Sistema de diseño](docs/DESIGN.md)

## Seguridad

- No hay secretos en el repositorio. La app solo usa la URL y la *anon key* públicas; toda autorización la aplica PostgreSQL con **Row Level Security**.
- Las finanzas personales solo las ve su dueño (también en vistas, auditoría, notificaciones, exportaciones y comprobantes).
- Los comprobantes viven en un bucket **privado** y se abren con URLs firmadas de 60–120 s.
- Ningún registro financiero se borra: se **anula** con motivo y queda en auditoría.
