# Base de datos

Migraciones en `supabase/migrations/`. Tablas principales:

| Tabla | Propósito |
|---|---|
| `households`, `household_members`, `household_invites` | Hogar, miembros (pueden existir antes de unirse) e invitaciones de un solo uso (7 días) |
| `income_records` | Historial de ingresos mensuales por miembro |
| `categories` | Categorías/subcategorías (hogar o personales), con fondo vinculado opcional |
| `payment_methods` | Métodos de pago |
| `budget_periods`, `budget_allocations` | Presupuesto mensual por categoría y distribución `{member_id: %}` |
| `budget_moves` | Reasignaciones, sobrantes a fondo/ahorro, reservas para el mes siguiente, coberturas de excesos |
| `funds` | Caja chica, salidas, común, emergencia, personalizados y cuentas personales |
| `savings_goals` | Metas compartidas o personales con compromisos mensuales por miembro |
| `debts` | Deudas compartidas o personales (tasa opcional, cuotas, frecuencia) |
| `bills`, `bill_cycles` | Servicios y sus ciclos (vencimiento, monto esperado, reprogramación, cancelación) |
| `transactions` | **Libro mayor** |
| `transaction_attachments` | Comprobantes (Storage privado `receipts`) |
| `reminders`, `notifications`, `push_tokens` | Recordatorios, bandeja de notificaciones y tokens Expo |
| `audit_logs` | Auditoría de todas las tablas financieras |

## Tipos de movimiento

| Tipo | Efecto | ¿Es gasto? |
|---|---|---|
| `expense` | Consume presupuesto; sale de un fondo si se indica; puede pagar un ciclo de servicio | Sí |
| `refund` | Resta al gasto real | Reduce gasto |
| `income` | Ingreso; entra a un fondo si se indica | No |
| `contribution` | Aportación de un miembro al hogar (puede imputarse al mes siguiente = adelanto) | **No** |
| `transfer` | Fondo → fondo | **No** |
| `deposit` / `withdrawal` | Reposición / retiro de un fondo | No |
| `savings_deposit` / `savings_withdrawal` | Aporte / retiro de una meta | **No** |
| `debt_payment` | Abono: reduce el saldo de la deuda | Se reporta aparte |
| `debt_charge` | Interés o recargo: aumenta el saldo | No mueve dinero |

## Reglas contables garantizadas por la base de datos

- **A. Presupuesto ≠ gasto**: el gasto real sale solo de `expense − refund`.
- **B/C. Aportes y transferencias no son gasto** (nunca entran en `v_allocations.spent`).
- **D. Abonos reducen la deuda**; un abono que deje el saldo < 0 se rechaza (`SOBREPAGO_DEUDA`) salvo `allow_overpayment` explícito.
- **E. Monto real variable**: un ciclo se paga con el monto real; puede diferir del estimado.
- **F. Sin duplicidad**: `client_request_id` único.
- **G. Fondos consistentes**: ningún fondo ni meta queda con saldo negativo (`FONDO_INSUFICIENTE`, `AHORRO_INSUFICIENTE`). No se inventa saldo: los fondos nacen en RD$0.
- **H. Privacidad**: referencias entre ámbitos prohibidas (`AMBITO_INCOMPATIBLE`); RLS por dueño.
- **I. Atomicidad**: una fila por operación o funciones SQL transaccionales; bloqueos por fila.
- **Sin borrados**: `DELETE` revocado; anulación con motivo (`void_transaction`), auditoría automática.

## Funciones RPC

`create_household`, `create_invite`, `accept_invite`, `ensure_period`, `copy_previous_budget`,
`adjust_allocation`, `move_budget`, `void_budget_move`, `void_transaction`, `ensure_bill_cycles`,
`create_next_bill_cycle`, `register_push_token`, `delete_attachment`, `generate_notifications` (solo cron).

## Endurecimiento (migración 4)

- Las funciones internas `SECURITY DEFINER` (saldos por id, notificaciones, creación de periodos, triggers)
  no son invocables desde la API: solo las RPC públicas listadas arriba.
- Nadie puede auto-promoverse a administrador ni reasignar la cuenta de otro miembro; el hogar siempre
  conserva al menos un administrador.
- El monto de un presupuesto solo cambia con `adjust_allocation` (motivo obligatorio).
- Un comprobante solo puede registrarse con una ruta `{hogar}/{movimiento}/…` del propio movimiento.

## Pruebas

`supabase/tests/database/01_ledger_security.test.sql` (pgTAP, 77 aserciones), `02_hardening.test.sql` (11) y
`tests/integration/api.test.ts` (API real con dos usuarios y un externo).
