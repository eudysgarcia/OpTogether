import React from 'react';
import { Image, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { Text } from '../ui/Text';

export function Isotype({ size = 72 }: { size?: number }) {
  const { dark } = useTheme();
  const img = <Image source={require('../../../assets/brand/isotype.png')} style={{ width: size, height: size * 0.9 }} resizeMode="contain" accessibilityLabel="OpTogether" />;
  if (!dark) return img;
  return (
    <View style={{ backgroundColor: '#FFFFFF', borderRadius: radius.lg, padding: size * 0.12 }}>{img}</View>
  );
}

export function Wordmark({ size = 'lg', tagline = true }: { size?: 'md' | 'lg'; tagline?: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: space[1] }}>
      <Text variant={size === 'lg' ? 'display' : 'h1'} color="brand" style={{ letterSpacing: -1 }}>
        Op<Text variant={size === 'lg' ? 'display' : 'h1'} color="text" style={{ letterSpacing: -1 }}>Together</Text>
      </Text>
      {tagline && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <View style={{ width: 16, height: 2, borderRadius: 1, backgroundColor: '#FFCB2F' }} />
          <Text variant="caption" color="textSecondary">Construyendo nuestro futuro, juntos</Text>
          <View style={{ width: 16, height: 2, borderRadius: 1, backgroundColor: '#FFCB2F' }} />
        </View>
      )}
    </View>
  );
}
