import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable as RNPressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const APressable = Animated.createAnimatedComponent(RNPressable);

/** Pressable con feedback de escala sutil y háptico ligero. */
export function Pressable({
  style, haptic = false, scaleTo = 0.97, onPressIn, onPressOut, onPress, ...rest
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; haptic?: boolean; scaleTo?: number }) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <APressable
      {...rest}
      accessibilityRole={rest.accessibilityRole ?? 'button'}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, { damping: 20, stiffness: 400 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 16, stiffness: 300 });
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
      style={[style, anim]}
    />
  );
}
