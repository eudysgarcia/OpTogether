import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/tokens';

const ACircle = Animated.createAnimatedComponent(Circle);

/** Barra de progreso animada. Si ratio > 1 muestra la porción de exceso con otro color. */
export function ProgressBar({
  ratio, color, track, height = 8, showExcess = true, accessibilityLabel,
}: { ratio: number; color?: string; track?: string; height?: number; showExcess?: boolean; accessibilityLabel?: string }) {
  const { colors } = useTheme();
  const safe = Number.isFinite(ratio) ? Math.max(0, ratio) : ratio > 0 ? 2 : 0;
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(Math.min(safe, 1), { duration: 650, easing: Easing.out(Easing.cubic) });
  }, [safe, w]);
  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  const exceeded = showExcess && safe > 1;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(safe, 9.99) * 100) }}
      style={{ height, borderRadius: radius.pill, backgroundColor: track ?? colors.surfaceAlt, overflow: 'hidden', flexDirection: 'row' }}
    >
      <Animated.View style={[{ height, borderRadius: radius.pill, backgroundColor: exceeded ? colors.excess : color ?? colors.brand }, fill]} />
    </View>
  );
}

/** Anillo de progreso (ahorros, consumo global). */
export function Ring({
  ratio, size = 64, stroke = 7, color, track, children,
}: { ratio: number; size?: number; stroke?: number; color?: string; track?: string; children?: React.ReactNode }) {
  const { colors } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = useSharedValue(0);
  const target = Number.isFinite(ratio) ? Math.max(0, Math.min(ratio, 1)) : 1;
  useEffect(() => {
    p.value = withTiming(target, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [target, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? colors.surfaceAlt} strokeWidth={stroke} fill="none" />
        <ACircle
          cx={size / 2} cy={size / 2} r={r} stroke={color ?? colors.brand} strokeWidth={stroke} fill="none"
          strokeDasharray={`${c} ${c}`} strokeLinecap="round" animatedProps={props}
        />
      </Svg>
      {children}
    </View>
  );
}
