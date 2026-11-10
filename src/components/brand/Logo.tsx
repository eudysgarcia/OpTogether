import React from 'react';
import { Image, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';
import { Text } from '../ui/Text';

/** Isotipo (casa, pareja y corazón con barras). Fondo transparente: funciona en claro y oscuro. */
export function Isotype({ size = 72 }: { size?: number }) {
  return (
    <Image source={require('../../../assets/brand/isotype.png')} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel="OpTogether" />
  );
}

/** Logotipo: "Op" marino · "To" azul · "gether" morado, con subrayado dorado. */
export function Wordmark({ size = 'lg', tagline = true }: { size?: 'md' | 'lg'; tagline?: boolean }) {
  const { colors, dark } = useTheme();
  const v = size === 'lg' ? 'display' : 'h1';
  return (
    <View style={{ alignItems: 'center', gap: space[1] }} accessible accessibilityLabel="OpTogether. Construyendo nuestro futuro, juntos">
      <Text variant={v} style={{ letterSpacing: -1 }} color={dark ? '#FFFFFF' : colors.brand}>
        Op
        <Text variant={v} color={colors.brandBlue} style={{ letterSpacing: -1 }}>To</Text>
        <Text variant={v} color={colors.brandPurple} style={{ letterSpacing: -1 }}>gether</Text>
      </Text>
      {tagline && (
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text variant="caption" color="textSecondary" style={{ letterSpacing: 0.6 }}>Construyendo nuestro futuro, juntos</Text>
          <View style={{ width: 90, height: 3, borderRadius: 2, backgroundColor: colors.accent, alignSelf: 'flex-end', transform: [{ rotate: '-2deg' }] }} />
        </View>
      )}
    </View>
  );
}
