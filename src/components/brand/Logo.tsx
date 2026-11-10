import React from 'react';
import { Image, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { Text } from '../ui/Text';

/** Isotipo v4: ícono "OT" con anillo violeta y destello dorado sobre azul noche. */
export function Isotype({ size = 72 }: { size?: number }) {
  return (
    <Image
      source={require('../../../assets/brand/isotype.png')}
      style={{ width: size, height: size, borderRadius: radius.lg }}
      resizeMode="contain"
      accessibilityLabel="OpTogether"
    />
  );
}

/** Destello de cuatro puntas (el de la marca). */
function Sparkle({ size = 14, color = '#FBBF24' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 0 C13 7 17 11 24 12 C17 13 13 17 12 24 C11 17 7 13 0 12 C7 11 11 7 12 0 Z" fill={color} />
    </Svg>
  );
}

/** Logotipo v4: "Op" en tinta · "To" violeta · "gether" violeta→azul, con trazo violeta y destello dorado. */
export function Wordmark({ size = 'lg', tagline = true }: { size?: 'md' | 'lg'; tagline?: boolean }) {
  const { colors, dark } = useTheme();
  const v = size === 'lg' ? 'display' : 'h1';
  const ink = dark ? '#FFFFFF' : '#0E1538';
  const ls = { letterSpacing: -1 };
  return (
    <View style={{ alignItems: 'center' }} accessible accessibilityLabel="OpTogether. Construyendo nuestro futuro, juntos">
      <Text variant={v} style={ls} color={ink}>
        Op
        <Text variant={v} style={ls} color={colors.brandPurple}>To</Text>
        <Text variant={v} style={ls} color={dark ? '#A78BFA' : '#5B3BEA'}>ge</Text>
        <Text variant={v} style={ls} color={dark ? '#93B4FB' : '#3B5BEA'}>th</Text>
        <Text variant={v} style={ls} color={dark ? '#60A5FA' : '#2563EB'}>er</Text>
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -2, marginLeft: size === 'lg' ? 56 : 40 }}>
        <View style={{ width: size === 'lg' ? 150 : 110, height: 3, borderRadius: 2, backgroundColor: colors.brandPurple, transform: [{ rotate: '-3deg' }] }} />
        <Sparkle size={size === 'lg' ? 16 : 12} />
      </View>
      {tagline && (
        <Text variant="caption" color="textSecondary" style={{ letterSpacing: 0.6, marginTop: space[1] }}>
          Construyendo nuestro futuro, juntos
        </Text>
      )}
    </View>
  );
}
