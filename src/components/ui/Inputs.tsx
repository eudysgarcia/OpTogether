import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, layout, radius, space, type as typeScale } from '../../theme/tokens';
import { formatDate, parseISODate, toISODate } from '../../lib/dates';
import { Icon, type IconName } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

export function Field({ label, error, helper, children, required }: { label?: string; error?: string; helper?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      {label && (
        <Text variant="label" color="textSecondary">
          {label}
          {required ? ' *' : ''}
        </Text>
      )}
      {children}
      {error ? (
        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }} accessibilityLiveRegion="polite">
          <Icon name="alert-circle" size={14} color="#D92D20" />
          <Text variant="caption" color="negative">{error}</Text>
        </View>
      ) : helper ? (
        <Text variant="caption" color="textTertiary">{helper}</Text>
      ) : null}
    </View>
  );
}

type InputProps = TextInputProps & { label?: string; error?: string; helper?: string; icon?: IconName; required?: boolean; right?: React.ReactNode };

export function Input({ label, error, helper, icon, required, right, style, multiline, ...rest }: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Field label={label} error={error} helper={helper} required={required}>
      <View
        style={[
          styles.box,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.negative : focused ? colors.brand : colors.borderStrong,
            borderWidth: focused || error ? 1.5 : 1,
            minHeight: multiline ? 96 : layout.minTouch + 4,
            alignItems: multiline ? 'flex-start' : 'center',
          },
        ]}
      >
        {icon && <Icon name={icon} size={18} color={colors.textTertiary} />}
        <TextInput
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel={label}
          multiline={multiline}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[typeScale.body, { flex: 1, color: colors.text, paddingVertical: multiline ? space[3] : 0, textAlignVertical: multiline ? 'top' : 'center' }, style]}
        />
        {right}
      </View>
    </Field>
  );
}

/** Monto grande con teclado numérico. */
export function AmountInput({
  value, onChange, error, label = 'Monto', autoFocus, tone = 'default', testID,
}: { value: string; onChange: (v: string) => void; error?: string; label?: string; autoFocus?: boolean; tone?: 'default' | 'income' | 'expense'; testID?: string }) {
  const { colors } = useTheme();
  const color = tone === 'income' ? colors.positive : colors.text;
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Text variant="overline" color="textSecondary">{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Text variant="amountL" color="textTertiary">RD$</Text>
        <TextInput
          testID={testID}
          value={value}
          onChangeText={(t) => onChange(t.replace(/[^\d.,]/g, ''))}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder="0.00"
          placeholderTextColor={colors.borderStrong}
          autoFocus={autoFocus}
          accessibilityLabel={label}
          maxLength={14}
          style={{ fontFamily: fonts.display, fontSize: 44, letterSpacing: -1, color, minWidth: 120, textAlign: 'center', paddingVertical: 4 }}
        />
      </View>
      {error && <Text variant="caption" color="negative">{error}</Text>}
    </View>
  );
}

export function Chip({
  label, selected, onPress, icon, color, testID,
}: { label: string; selected?: boolean; onPress?: () => void; icon?: string; color?: string; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      haptic
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space[3] + 2, height: 38, borderRadius: radius.pill,
        backgroundColor: selected ? colors.brand : colors.surface, borderWidth: 1, borderColor: selected ? colors.brand : colors.border,
      }}
    >
      {icon && <Icon name={icon} size={16} color={selected ? colors.onBrand : color ?? colors.textSecondary} />}
      <Text variant="label" color={selected ? colors.onBrand : colors.text}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2], paddingVertical: 2 }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Segmented<T extends string>({
  options, value, onChange, testID,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4, gap: 4 }}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            haptic
            accessibilityRole="tab"
            accessibilityState={{ selected: sel }}
            style={{ flex: 1, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? colors.surface : 'transparent' }}
          >
            <Text variant="label" color={sel ? 'text' : 'textSecondary'} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DateField({ label, value, onChange, error, minimumDate }: { label?: string; value: string; onChange: (iso: string) => void; error?: string; minimumDate?: Date }) {
  const { colors, dark } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Field label={label} error={error}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityLabel={`${label ?? 'Fecha'}: ${formatDate(value, 'long')}`}
        style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderStrong, borderWidth: 1, minHeight: layout.minTouch + 4 }]}
      >
        <Icon name="calendar" size={18} color={colors.textTertiary} />
        <Text variant="body" style={{ flex: 1 }}>{formatDate(value, 'long')}</Text>
        <Icon name="chevron-down" size={18} color={colors.textTertiary} />
      </Pressable>
      {open && (
        <DateTimePicker
          value={parseISODate(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          themeVariant={dark ? 'dark' : 'light'}
          minimumDate={minimumDate}
          onChange={(e, d) => {
            setOpen(Platform.OS === 'ios');
            if (e.type === 'set' && d) onChange(toISODate(d));
          }}
        />
      )}
    </Field>
  );
}

export function Switch({ value, onChange, label, description, testID }: { value: boolean; onChange: (v: boolean) => void; label: string; description?: string; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!value)}
      haptic
      scaleTo={0.99}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: layout.minTouch }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{label}</Text>
        {description && <Text variant="caption" color="textSecondary">{description}</Text>}
      </View>
      <View style={{ width: 48, height: 28, borderRadius: 14, padding: 3, backgroundColor: value ? colors.brand : colors.borderStrong, alignItems: value ? 'flex-end' : 'flex-start' }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' }} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: space[2] + 2, borderRadius: radius.md, paddingHorizontal: space[3] + 2 },
});
