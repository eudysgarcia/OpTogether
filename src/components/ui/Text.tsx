import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { type ThemeColors, type TypeVariant, type as typeScale } from '../../theme/tokens';

type Props = TextProps & {
  variant?: TypeVariant;
  color?: keyof ThemeColors | (string & {});
  align?: TextStyle['textAlign'];
  tabular?: boolean;
  weight?: TextStyle['fontWeight'];
};

export function Text({ variant = 'body', color = 'text', align, tabular, style, ...rest }: Props) {
  const { colors } = useTheme();
  const c = (colors as Record<string, string>)[color] ?? color;
  const isAmount = variant.startsWith('amount');
  return (
    <RNText
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[
        typeScale[variant],
        { color: c, textAlign: align },
        (tabular || isAmount) && { fontVariant: ['tabular-nums'] },
        variant === 'overline' && { textTransform: 'uppercase' },
        style,
      ]}
    />
  );
}
