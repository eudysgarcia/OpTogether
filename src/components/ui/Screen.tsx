import { router } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { layout, space } from '../../theme/tokens';
import { IconButton } from './Button';
import { Text } from './Text';

export function Header({
  title, subtitle, back = false, right, large = false, onBack,
}: { title: string; subtitle?: string; back?: boolean; right?: React.ReactNode; large?: boolean; onBack?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 56, paddingHorizontal: back ? space[2] : layout.screenPadding, paddingRight: layout.screenPadding - space[2] }}>
      {back && (
        <IconButton
          icon="chevron-left"
          label="Volver"
          onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        />
      )}
      <View style={{ flex: 1 }}>
        <Text variant={large ? 'h1' : 'h2'} numberOfLines={1} accessibilityRole="header">{title}</Text>
        {subtitle && <Text variant="caption" color="textSecondary" numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>{right}</View>}
    </View>
  );
}

/** Pantalla base: safe areas, scroll, pull-to-refresh, teclado. */
export function Screen({
  children, header, scroll = true, refreshing, onRefresh, contentStyle, footer, padded = true, testID, bottomInset = true,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: React.ReactNode;
  padded?: boolean;
  testID?: string;
  bottomInset?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pad: ViewStyle = { paddingHorizontal: padded ? layout.screenPadding : 0, gap: space[4] };
  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {header}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={[pad, { paddingTop: space[2], paddingBottom: (bottomInset ? insets.bottom : 0) + (footer ? space[4] : 110) }, contentStyle]}
            refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} /> : undefined}
          >
            <View style={{ width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', gap: space[4] }}>{children}</View>
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
        )}
        {footer && (
          <View style={{ paddingHorizontal: layout.screenPadding, paddingTop: space[3], paddingBottom: insets.bottom + space[3], backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
            {footer}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
