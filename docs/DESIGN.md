# Sistema de diseño

Tokens en `src/theme/tokens.ts`; ningún componente usa colores, radios o espaciados literales.

## Identidad (v4)
Ícono: "OT" (O cian→azul, T blanca) con anillo violeta y destello dorado, sobre azul noche con ondas
(`assets/brand/isotype.png`, extraído de `assets/brand/branding-source-v4.png`). Logotipo: **Op** en tinta ·
**To** violeta · **gether** en degradado violeta→azul, con trazo violeta y destello dorado.

| Color | Hex | Uso |
|---|---|---|
| Azul noche | `#0B0A40` | Fondo del ícono |
| Azul marino | `#1F2C66` | Marca principal: navegación, encabezado del inicio, botones primarios |
| Violeta | `#7C3AED` | Acento (≈10 %): botón de registro rápido, progreso, “To” del logotipo |
| Azul | `#2563EB` | Marca secundaria, aportaciones |
| Dorado | `#FBBF24` | Destello de la marca y avisos |

## Color (60 / 30 / 10)
- **60 % blanco / superficies**, **30 % marino y azules de marca**, **10 % violeta**.
- Semánticos financieros, uno por concepto y nunca un color de marca: presupuesto `budget` (marino),
  gasto `spent`, disponible `available` (verde), exceso `excess` (rojo), ahorro `savings` (teal),
  deuda `debt` (rosa oscuro), fondos `fund` (ámbar), aportaciones `contribution` (azul).
- Tema oscuro completo con los mismos roles.

## Tipografía
Manrope (títulos y cifras, numerales tabulares) + Inter (texto). Escala: display 34 · h1 26 · h2 20 · h3 17 · body 15 · caption 13 · overline 11; montos XL 38 / L 24 / M 17 / S 14.

## Espaciado y forma
Base 4 (4–64). Margen de pantalla 20. Radios 6 / 10 / 14 / 20 / 28. Áreas táctiles ≥ 44–48 px. Sombras suaves (sm/md/lg).

## Componentes
`Text`, `Money` (formato RD$ + modo ocultar montos), `Button`, `IconButton`, `Card`, `SectionHeader`, `Input`,
`AmountInput` (teclado numérico), `Chip`, `Segmented`, `DateField`, `Switch`, `Sheet` (bottom sheet), `Select`,
`StatusPill` (icono + texto, nunca solo color), `ProgressBar`, `Ring`, `Skeleton`, `EmptyState`, `ErrorState`,
`Banner`, `Toaster`, `OfflineBanner`, `ConfirmSheet` (con motivo obligatorio). Financieros: `TxRow`, `TxList`,
`BudgetRow`, `BillCycleRow`, `GoalCard`, `DebtCard`, `FundCard`, `PeriodSelector`, `CategoryGrid`. Gráficos SVG:
`DonutChart`, `BudgetBars`, `TrendLine`, `StackedBar`.

## Microinteracciones
Escala + háptico en pulsaciones, barras y anillos animados, transiciones de hojas, skeletons, pantalla de éxito al registrar.

## Accesibilidad
Etiquetas en controles, roles (`button`, `tab`, `switch`, `progressbar`, `alert`), estados de selección,
`maxFontSizeMultiplier` controlado, contraste AA en los pares de color principales.
