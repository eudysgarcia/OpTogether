import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, space } from '../../theme/tokens';
import { Text } from '../ui/Text';
import { formatMoney } from '../../lib/money';

/** Paleta categórica derivada de la marca (validada para contraste en claro/oscuro). */
export const CHART_COLORS = ['#1F2C66', '#FFCB2F', '#0E7C86', '#6346C9', '#14935D', '#C2570C', '#7C88C2', '#D92D20', '#3D4E99', '#E0A800'];
export const CHART_COLORS_DARK = ['#8C9BE6', '#FFCB2F', '#2EB8C4', '#9C84F0', '#1DB173', '#F08A3E', '#C9CFEA', '#F2564B', '#5C6FD1', '#FFE08A'];

export function useChartColors() {
  const { dark } = useTheme();
  return dark ? CHART_COLORS_DARK : CHART_COLORS;
}

export type Slice = { label: string; value: number; color?: string };

/** Donut con total al centro y leyenda accesible. */
export function DonutChart({ data, size = 168, centerLabel, centerValue }: { data: Slice[]; size?: number; centerLabel?: string; centerValue?: string }) {
  const { colors } = useTheme();
  const palette = useChartColors();
  const total = data.reduce((a, d) => a + Math.max(0, d.value), 0);
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  const gap = data.length > 1 ? 2 : 0;
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}
      accessible
      accessibilityLabel={`Gráfico: ${data.map((d) => `${d.label} ${formatMoney(d.value, { compact: true })}`).join(', ')}`}
    >
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceAlt} strokeWidth={stroke} fill="none" />
          {total > 0 &&
            data.map((d, i) => {
              const len = (Math.max(0, d.value) / total) * c;
              const el = (
                <Circle
                  key={i}
                  cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color ?? palette[i % palette.length]} strokeWidth={stroke}
                  strokeDasharray={`${Math.max(len - gap, 0.1)} ${c}`} strokeDashoffset={-acc}
                />
              );
              acc += len;
              return el;
            })}
        </Svg>
        {centerValue && (
          <View style={{ alignItems: 'center', maxWidth: size - stroke * 2 - 8 }}>
            <Text variant="amountS" numberOfLines={1} adjustsFontSizeToFit>{centerValue}</Text>
            {centerLabel && <Text variant="caption" color="textSecondary">{centerLabel}</Text>}
          </View>
        )}
      </View>
      <View style={{ flex: 1, gap: space[2] }}>
        {data.slice(0, 6).map((d, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: d.color ?? palette[i % palette.length] }} />
            <Text variant="caption" style={{ flex: 1 }} numberOfLines={1}>{d.label}</Text>
            <Text variant="caption" color="textSecondary" tabular>{total > 0 ? Math.round((d.value / total) * 100) : 0}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Barras agrupadas: presupuesto (contorno) vs gasto real (sólido). */
export function BudgetBars({ data, height = 180 }: { data: { label: string; budget: number; spent: number }[]; height?: number }) {
  const { colors } = useTheme();
  const [w, setW] = React.useState(0);
  const max = Math.max(1, ...data.flatMap((d) => [d.budget, d.spent]));
  const top = 8;
  const bottom = 24;
  const ih = height - top - bottom;
  const bw = data.length ? Math.min(28, (w / data.length) * 0.55) : 0;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} accessible accessibilityLabel="Presupuesto contra gasto real por categoría">
      {w > 0 && (
        <Svg width={w} height={height}>
          {[0.25, 0.5, 0.75, 1].map((g) => (
            <Line key={g} x1={0} x2={w} y1={top + ih * (1 - g)} y2={top + ih * (1 - g)} stroke={colors.border} strokeWidth={1} strokeDasharray="3 4" />
          ))}
          {data.map((d, i) => {
            const cx = (w / data.length) * (i + 0.5);
            const bh = (d.budget / max) * ih;
            const sh = (d.spent / max) * ih;
            const over = d.spent > d.budget;
            return (
              <G key={i}>
                <Rect x={cx - bw / 2} y={top + ih - bh} width={bw} height={Math.max(bh, 1)} rx={6} fill={colors.brandSoft} stroke={colors.budget} strokeWidth={1} strokeOpacity={0.35} />
                <Rect x={cx - bw / 2 + 4} y={top + ih - sh} width={Math.max(bw - 8, 2)} height={Math.max(sh, d.spent > 0 ? 2 : 0)} rx={4} fill={over ? colors.excess : colors.brand} />
                <SvgText x={cx} y={height - 6} fontSize={10} fontFamily={fonts.body} fill={colors.textSecondary} textAnchor="middle">
                  {d.label.length > 7 ? `${d.label.slice(0, 6)}…` : d.label}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      )}
      <View style={{ flexDirection: 'row', gap: space[4], marginTop: space[2] }}>
        <Legend color={colors.brandSoft} border={colors.budget} label="Presupuesto" />
        <Legend color={colors.brand} label="Gasto real" />
        <Legend color={colors.excess} label="Exceso" />
      </View>
    </View>
  );
}

function Legend({ color, label, border }: { color: string; label: string; border?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color, borderWidth: border ? 1 : 0, borderColor: border }} />
      <Text variant="caption" color="textSecondary">{label}</Text>
    </View>
  );
}

/** Línea de evolución mensual con área suave. */
export function TrendLine({ data, height = 150, color }: { data: { label: string; value: number }[]; height?: number; color?: string }) {
  const { colors } = useTheme();
  const [w, setW] = React.useState(0);
  const stroke = color ?? colors.brand;
  const max = Math.max(1, ...data.map((d) => d.value));
  const top = 12;
  const bottom = 22;
  const ih = height - top - bottom;
  const pts = data.map((d, i) => ({
    x: data.length > 1 ? 12 + ((w - 24) * i) / (data.length - 1) : w / 2,
    y: top + ih - (d.value / max) * ih,
  }));
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
  const area = pts.length ? `${path} L${pts[pts.length - 1].x},${top + ih} L${pts[0].x},${top + ih} Z` : '';
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} accessible accessibilityLabel={`Evolución: ${data.map((d) => `${d.label} ${formatMoney(d.value, { compact: true })}`).join(', ')}`}>
      {w > 0 && data.length > 0 && (
        <Svg width={w} height={height}>
          <Path d={area} fill={stroke} fillOpacity={0.08} />
          <Path d={path} stroke={stroke} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p, i) => (
            <G key={i}>
              <Circle cx={p.x} cy={p.y} r={4} fill={colors.surface} stroke={stroke} strokeWidth={2} />
              <SvgText x={p.x} y={height - 4} fontSize={10} fontFamily={fonts.body} fill={colors.textSecondary} textAnchor="middle">
                {data[i].label}
              </SvgText>
            </G>
          ))}
        </Svg>
      )}
    </View>
  );
}

/** Barra apilada horizontal (aportaciones por miembro, distribución). */
export function StackedBar({ parts, height = 12 }: { parts: { value: number; color: string; label: string }[]; height?: number }) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0);
  return (
    <View style={{ flexDirection: 'row', height, borderRadius: height / 2, overflow: 'hidden', gap: 2 }} accessibilityLabel={parts.map((p) => `${p.label} ${Math.round((p.value / Math.max(total, 1)) * 100)}%`).join(', ')}>
      {parts.map((p, i) => (
        <View key={i} style={{ flex: Math.max(p.value, 0.0001), backgroundColor: p.color }} />
      ))}
    </View>
  );
}
