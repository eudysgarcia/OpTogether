import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { elevation, radius, space } from '../../theme/tokens';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { Icon } from './Icon';

export function Card({
  children, style, onPress, padded = true, tone = 'surface', testID, accessibilityLabel,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
  tone?: 'surface' | 'alt' | 'brand';
  testID?: string;
  accessibilityLabel?: string;
}) {
  const { colors, dark } = useTheme();
  const bg = tone === 'alt' ? colors.surfaceAlt : tone === 'brand' ? colors.brand : colors.surface;
  const base: ViewStyle = {
    backgroundColor: bg,
    borderRadius: radius.lg,
    padding: padded ? space[4] : 0,
    borderWidth: dark || tone !== 'surface' ? 0 : 1,
    borderColor: colors.border,
    ...(tone === 'surface' && !dark ? elevation.sm : {}),
  };
  if (onPress) {
    return (
      <Pressable testID={testID} onPress={onPress} scaleTo={0.985} style={[base, style]} accessibilityLabel={accessibilityLabel}>
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[base, style]} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
}

/** Encabezado de sección con acción opcional ("Ver todo"). */
export function SectionHeader({ title, action, onAction, subtitle }: { title: string; action?: string; onAction?: () => void; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: space[3], marginTop: space[2] }}>
      <View style={{ flex: 1 }}>
        <Text variant="h3" accessibilityRole="header">{title}</Text>
        {subtitle && <Text variant="caption" color="textSecondary">{subtitle}</Text>}
      </View>
      {action && (
        <Pressable onPress={onAction} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 }}>
          <Text variant="label" color="brand">{action}</Text>
          <Icon name="chevron-right" size={16} color={colors.brand} />
        </Pressable>
      )}
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border, marginLeft: inset }} />;
}
