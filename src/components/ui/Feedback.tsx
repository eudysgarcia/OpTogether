import React, { useEffect } from 'react';
import { ActivityIndicator, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { Pressable } from './Pressable';
import { errorMessage, isNetworkError } from '../../lib/errors';

export function Skeleton({ width = '100%', height = 16, r = radius.sm, style }: { width?: DimensionValue; height?: number; r?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const o = useSharedValue(0.5);
  useEffect(() => {
    o.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.5, { duration: 700 })), -1);
  }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width, height, borderRadius: r, backgroundColor: colors.skeleton }, a, style]} />;
}

/** Esqueleto de lista estándar. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View style={{ gap: space[4] }} accessibilityLabel="Cargando" accessibilityRole="progressbar">
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <Skeleton width={42} height={42} r={radius.md} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="35%" height={12} />
          </View>
          <Skeleton width={70} height={16} />
        </View>
      ))}
    </View>
  );
}

export function EmptyState({
  icon, title, message, action, onAction, compact,
}: { icon: IconName; title: string; message?: string; action?: string; onAction?: () => void; compact?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: compact ? space[5] : space[10], paddingHorizontal: space[6], gap: space[3] }}>
      <View style={{ width: compact ? 52 : 68, height: compact ? 52 : 68, borderRadius: radius.pill, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={compact ? 24 : 30} color={colors.brand} />
      </View>
      <Text variant="h3" align="center">{title}</Text>
      {message && <Text variant="body" color="textSecondary" align="center">{message}</Text>}
      {action && onAction && <Button title={action} onPress={onAction} full={false} size="md" style={{ marginTop: space[2] }} />}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const offline = isNetworkError(error);
  return (
    <EmptyState
      icon={offline ? 'offline' : 'alert-circle'}
      title={offline ? 'Sin conexión' : 'No pudimos cargar esto'}
      message={offline ? 'Mostraremos los datos guardados cuando estén disponibles. Revisa tu conexión.' : errorMessage(error)}
      action={onRetry ? 'Reintentar' : undefined}
      onAction={onRetry}
    />
  );
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ padding: space[8], alignItems: 'center', gap: space[3] }}>
      <ActivityIndicator color={colors.brand} />
      <Text variant="caption" color="textSecondary">{label}</Text>
    </View>
  );
}

/** Aviso contextual (alerta, info, éxito). Usa icono + texto, nunca solo color. */
export function Banner({
  tone = 'info', title, message, icon, onPress, action,
}: { tone?: 'info' | 'warning' | 'danger' | 'success'; title: string; message?: string; icon?: IconName; onPress?: () => void; action?: string }) {
  const { colors } = useTheme();
  const map = {
    info: { bg: colors.brandSoft, fg: colors.brand, icon: 'info' as IconName },
    warning: { bg: colors.warningSoft, fg: colors.warning, icon: 'alert' as IconName },
    danger: { bg: colors.negativeSoft, fg: colors.negative, icon: 'alert-circle' as IconName },
    success: { bg: colors.positiveSoft, fg: colors.positive, icon: 'check-circle' as IconName },
  }[tone];
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      accessibilityRole={onPress ? 'button' : 'alert'}
      onPress={onPress}
      style={{ flexDirection: 'row', gap: space[3], padding: space[3] + 2, borderRadius: radius.md, backgroundColor: map.bg, alignItems: 'flex-start' }}
    >
      <Icon name={icon ?? map.icon} size={20} color={map.fg} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" color={map.fg}>{title}</Text>
        {message && <Text variant="caption" color="text">{message}</Text>}
      </View>
      {action && <Text variant="label" color={map.fg}>{action}</Text>}
    </Wrapper>
  );
}
