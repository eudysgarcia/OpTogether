import React from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { layout, radius, space } from '../../theme/tokens';
import { Icon, type IconName } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'outline';

export function Button({
  title, onPress, variant = 'primary', icon, loading, disabled, size = 'lg', style, full = true, testID, accessibilityHint,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'md' | 'lg' | 'sm';
  style?: StyleProp<ViewStyle>;
  full?: boolean;
  testID?: string;
  accessibilityHint?: string;
}) {
  const { colors } = useTheme();
  const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.brand, fg: colors.onBrand },
    accent: { bg: colors.accent, fg: colors.onAccent },
    secondary: { bg: colors.brandSoft, fg: colors.brand },
    ghost: { bg: 'transparent', fg: colors.brand },
    outline: { bg: 'transparent', fg: colors.text, border: colors.borderStrong },
    danger: { bg: colors.negativeSoft, fg: colors.negative },
  };
  const p = palette[variant];
  const h = size === 'lg' ? 54 : size === 'md' ? layout.minTouch : 38;
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      haptic
      disabled={inactive}
      onPress={onPress}
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={[
        styles.base,
        {
          height: h,
          backgroundColor: p.bg,
          borderColor: p.border ?? 'transparent',
          borderWidth: p.border ? 1 : 0,
          opacity: disabled ? 0.45 : 1,
          alignSelf: full ? 'stretch' : 'flex-start',
          paddingHorizontal: size === 'sm' ? space[3] : space[5],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Icon name={icon} size={size === 'sm' ? 16 : 19} color={p.fg} />}
          <Text variant={size === 'sm' ? 'label' : 'bodyStrong'} color={p.fg}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon, onPress, label, tone = 'default', size = 44, badge, testID,
}: {
  icon: IconName;
  onPress?: () => void;
  label: string;
  tone?: 'default' | 'onBrand' | 'soft';
  size?: number;
  badge?: number;
  testID?: string;
}) {
  const { colors } = useTheme();
  const bg = tone === 'onBrand' ? 'rgba(255,255,255,0.12)' : tone === 'soft' ? colors.surfaceAlt : 'transparent';
  const fg = tone === 'onBrand' ? colors.onBrand : colors.text;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      haptic
      accessibilityLabel={label}
      hitSlop={6}
      style={{ width: size, height: size, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}
    >
      <Icon name={icon} size={20} color={fg} />
      {!!badge && (
        <View style={[styles.badge, { backgroundColor: colors.accent, borderColor: tone === 'onBrand' ? colors.brand : colors.surface }]}>
          <Text variant="overline" color="onAccent" style={{ fontSize: 10 }}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  badge: {
    position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
});
