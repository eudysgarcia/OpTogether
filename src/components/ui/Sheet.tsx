import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable as RNPressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { IconButton } from './Button';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

/** Bottom sheet modal con manejo de teclado y safe area. */
export function Sheet({
  visible, onClose, title, subtitle, children, footer, scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={{ position: 'absolute', inset: 0, backgroundColor: colors.overlay }}>
          <RNPressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Cerrar" />
        </Animated.View>
        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(190)}
          exiting={SlideOutDown.duration(180)}
          style={{
            backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
            maxHeight: '92%', paddingBottom: Math.max(insets.bottom, space[4]),
          }}
          accessibilityViewIsModal
        >
          <View style={{ alignItems: 'center', paddingTop: space[2] }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong }} />
          </View>
          {title && (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingTop: space[3], paddingBottom: space[2] }}>
              <View style={{ flex: 1 }}>
                <Text variant="h2" accessibilityRole="header">{title}</Text>
                {subtitle && <Text variant="caption" color="textSecondary">{subtitle}</Text>}
              </View>
              <IconButton icon="x" label="Cerrar" onPress={onClose} tone="soft" size={38} />
            </View>
          )}
          {scroll ? (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space[5], paddingTop: space[2], gap: space[4] }}>
              {children}
            </ScrollView>
          ) : (
            <View style={{ padding: space[5], paddingTop: space[2], gap: space[4] }}>{children}</View>
          )}
          {footer && <View style={{ paddingHorizontal: space[5], paddingTop: space[2], gap: space[2] }}>{footer}</View>}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export type SelectOption<T extends string = string> = { value: T; label: string; description?: string; icon?: string; color?: string };

/** Selector en bottom sheet (reemplaza pickers nativos inconsistentes). */
export function Select<T extends string>({
  label, value, options, onChange, placeholder = 'Seleccionar', error, allowClear, testID,
}: {
  label?: string;
  value: T | null | undefined;
  options: SelectOption<T>[];
  onChange: (v: T | null) => void;
  placeholder?: string;
  error?: string;
  allowClear?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={{ gap: 6 }}>
      {label && <Text variant="label" color="textSecondary">{label}</Text>}
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        accessibilityLabel={`${label ?? ''}: ${selected?.label ?? placeholder}`}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: space[2] + 2, minHeight: 52, borderRadius: radius.md,
          paddingHorizontal: space[3] + 2, borderWidth: error ? 1.5 : 1, borderColor: error ? colors.negative : colors.borderStrong,
          backgroundColor: colors.surface,
        }}
      >
        {selected?.icon && <Icon name={selected.icon} size={18} color={selected.color ?? colors.brand} />}
        <Text variant="body" color={selected ? 'text' : 'textTertiary'} style={{ flex: 1 }} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <Icon name="chevron-down" size={18} color={colors.textTertiary} />
      </Pressable>
      {error && <Text variant="caption" color="negative">{error}</Text>}
      <Sheet visible={open} onClose={() => setOpen(false)} title={label ?? placeholder}>
        <View style={{ gap: 2 }}>
          {allowClear && (
            <OptionRow label="Ninguno" selected={!value} onPress={() => { onChange(null); setOpen(false); }} />
          )}
          {options.map((o) => (
            <OptionRow
              key={o.value}
              label={o.label}
              description={o.description}
              icon={o.icon}
              color={o.color}
              selected={o.value === value}
              onPress={() => {
                onChange(o.value);
                setOpen(false);
              }}
            />
          ))}
          {!options.length && <Text variant="body" color="textSecondary">No hay opciones disponibles.</Text>}
        </View>
      </Sheet>
    </View>
  );
}

function OptionRow({ label, description, icon, color, selected, onPress }: { label: string; description?: string; icon?: string; color?: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      haptic
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 54, paddingHorizontal: space[2], borderRadius: radius.md, backgroundColor: selected ? colors.brandSoft : 'transparent' }}
    >
      {icon && (
        <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={18} color={color ?? colors.brand} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{label}</Text>
        {description && <Text variant="caption" color="textSecondary">{description}</Text>}
      </View>
      {selected && <Icon name="check" size={20} color={colors.brand} />}
    </Pressable>
  );
}
