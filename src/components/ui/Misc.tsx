import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { Icon, type IconName } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

export type Tone = 'neutral' | 'brand' | 'positive' | 'negative' | 'warning' | 'savings' | 'debt' | 'fund' | 'accent';

export function useToneColors(tone: Tone) {
  const { colors } = useTheme();
  return {
    neutral: { fg: colors.textSecondary, bg: colors.surfaceAlt },
    brand: { fg: colors.brand, bg: colors.brandSoft },
    positive: { fg: colors.positive, bg: colors.positiveSoft },
    negative: { fg: colors.negative, bg: colors.negativeSoft },
    warning: { fg: colors.warning, bg: colors.warningSoft },
    savings: { fg: colors.savings, bg: colors.savingsSoft },
    debt: { fg: colors.debt, bg: colors.debtSoft },
    fund: { fg: colors.fund, bg: colors.fundSoft },
    accent: { fg: colors.onAccent, bg: colors.accent },
  }[tone];
}

/** Estado con icono + texto (accesible: no depende solo del color). */
export function StatusPill({ label, tone = 'neutral', icon, small }: { label: string; tone?: Tone; icon?: IconName; small?: boolean }) {
  const c = useToneColors(tone);
  return (
    <View
      accessibilityLabel={`Estado: ${label}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: small ? 8 : 10, height: small ? 22 : 26, borderRadius: radius.pill, backgroundColor: c.bg, alignSelf: 'flex-start' }}
    >
      {icon && <Icon name={icon} size={small ? 12 : 14} color={c.fg} strokeWidth={2.4} />}
      <Text variant="caption" color={c.fg} style={{ fontSize: small ? 11 : 12, fontFamily: 'Inter_600SemiBold' }}>{label}</Text>
    </View>
  );
}

/** Contenedor de icono de categoría/fondo. */
export function IconTile({ icon, color, bg, size = 42 }: { icon: string; color?: string; bg?: string; size?: number }) {
  const { colors } = useTheme();
  const fg = color ?? colors.brand;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: bg ?? `${fg}1A`, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size * 0.46} color={fg} />
    </View>
  );
}

export function Avatar({ name, color, size = 36 }: { name: string; color?: string; size?: number }) {
  const { colors } = useTheme();
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const bg = color ?? colors.brand;
  const light = /^#F|^#E|^#D|^#C/i.test(bg);
  return (
    <View accessibilityLabel={name} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text variant="label" color={light ? '#0E1538' : '#FFFFFF'} style={{ fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

/** Fila de lista estándar. */
export function ListRow({
  icon, iconColor, title, subtitle, right, onPress, testID, danger, leading,
}: {
  icon?: string; iconColor?: string; title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void; testID?: string; danger?: boolean; leading?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const content = (
    <>
      {leading ?? (icon ? <IconTile icon={icon} color={danger ? colors.negative : iconColor} size={40} /> : null)}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" color={danger ? 'negative' : 'text'} numberOfLines={1}>{title}</Text>
        {subtitle && <Text variant="caption" color="textSecondary" numberOfLines={2}>{subtitle}</Text>}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" size={18} color={colors.textTertiary} /> : null)}
    </>
  );
  const style = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space[3], minHeight: 60, paddingVertical: space[2] };
  return onPress ? (
    <Pressable testID={testID} onPress={onPress} scaleTo={0.985} style={style} accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ''}`}>
      {content}
    </Pressable>
  ) : (
    <View testID={testID} style={style}>{content}</View>
  );
}

/** Par etiqueta / valor para detalles. */
export function KeyValue({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 36, gap: space[3] }}>
      <Text variant="body" color="textSecondary">{label}</Text>
      {children ?? <Text variant="bodyStrong" align="right" style={{ flexShrink: 1 }}>{value}</Text>}
    </View>
  );
}

/** Tarjeta de métrica compacta (KPI). */
export function Metric({ label, children, icon, tone = 'brand', onPress }: { label: string; children: React.ReactNode; icon: IconName; tone?: Tone; onPress?: () => void }) {
  const { colors } = useTheme();
  const c = useToneColors(tone);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      scaleTo={0.97}
      accessibilityLabel={label}
      style={{ flex: 1, minWidth: 140, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space[4], gap: space[2], borderWidth: 1, borderColor: colors.border }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={15} color={c.fg} />
        </View>
        <Text variant="caption" color="textSecondary" numberOfLines={1} style={{ flex: 1 }}>{label}</Text>
      </View>
      {children}
    </Pressable>
  );
}
