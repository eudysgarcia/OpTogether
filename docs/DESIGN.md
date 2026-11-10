# Sistema de diseño

Tokens en `src/theme/tokens.ts`; ningún componente usa colores, radios o espaciados literales.

## Color (60 / 30 / 10)
- **60 % blanco / superficies** (`surface`, `background`).
- **30 % azul marino de marca `#1F2C66`** (`brand`): navegación, encabezado del inicio, acciones primarias.
- **10 % amarillo `#FFCB2F`** (`accent`): botón de registro rápido, progreso del presupuesto en el inicio, indicadores no leídos.
- Semánticos financieros, uno por concepto: presupuesto `budget`, gasto `spent`, disponible `available` (verde),
  exceso `excess` (rojo), ahorro `savings` (teal), deuda `debt` (violeta), fondos `fund` (ámbar), aportaciones `contribution`.
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
