import React from 'react';
import { formatMoney } from '../../lib/money';
import { usePrefs } from '../../store/prefs';
import { Text } from './Text';
import type { TypeVariant, ThemeColors } from '../../theme/tokens';

/** Monto con formato RD$ y soporte para ocultar cifras (modo privacidad). */
export function Money({
  value, variant = 'amountM', color = 'text', compact, sign, align, style, testID,
}: {
  value: number | string | null | undefined;
  variant?: TypeVariant;
  color?: keyof ThemeColors | (string & {});
  compact?: boolean;
  sign?: boolean;
  align?: 'left' | 'right' | 'center';
  style?: object;
  testID?: string;
}) {
  const hidden = usePrefs((s) => s.hideAmounts);
  const text = formatMoney(value, { compact, sign, hidden });
  return (
    <Text
      variant={variant}
      color={color}
      align={align}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      accessibilityLabel={hidden ? 'Monto oculto' : `${text.replace('RD$', '')} pesos`}
      style={style}
      testID={testID}
    >
      {text}
    </Text>
  );
}
