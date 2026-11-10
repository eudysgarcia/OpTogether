import { router, Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs/types';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName, Pressable, Text } from '../../../components/ui';
import { useTheme } from '../../../theme/ThemeProvider';
import { elevation, radius, space } from '../../../theme/tokens';

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Inicio', icon: 'home' },
  { name: 'budget', label: 'Presupuesto', icon: 'pie' },
  { name: 'transactions', label: 'Movimientos', icon: 'list' },
  { name: 'more', label: 'Más', icon: 'grid' },
];

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(p) => <TabBar {...p} />}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}

function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const items = state.routes.map((r, i) => ({ ...r, focused: state.index === i, meta: TABS.find((t) => t.name === r.name)! }));
  const left = items.slice(0, 2);
  const right = items.slice(2);
  const renderItem = (r: (typeof items)[number]) => (
    <Pressable
      key={r.key}
      testID={`tab-${r.name}`}
      onPress={() => {
        const e = emitter.emit({ type: 'tabPress', target: r.key, canPreventDefault: true });
        if (!r.focused && !e.defaultPrevented) navigateToTab(r.key);
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: r.focused }}
      accessibilityLabel={r.meta.label}
      scaleTo={0.92}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: 56 }}
    >
      <View style={{ paddingHorizontal: 14, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: r.focused ? colors.brandSoft : 'transparent' }}>
        <Icon name={r.meta.icon} size={21} color={r.focused ? colors.brand : colors.textTertiary} strokeWidth={r.focused ? 2.4 : 2} />
      </View>
      <Text variant="caption" style={{ fontSize: 11 }} color={r.focused ? 'brand' : 'textTertiary'}>{r.meta.label}</Text>
    </Pressable>
  );
  return (
    <View style={{ backgroundColor: colors.tabBar, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: insets.bottom, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[2] }}>
      {left.map(renderItem)}
      <View style={{ width: 72, alignItems: 'center' }}>
        <Pressable
          testID="fab-add"
          haptic
          onPress={() => router.push('/transaction/new')}
          accessibilityLabel="Registrar movimiento"
          scaleTo={0.9}
          style={{ width: 58, height: 58, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: -26, borderWidth: 4, borderColor: colors.tabBar, ...elevation.md }}
        >
          <Icon name="plus" size={28} color={colors.onAccent} strokeWidth={2.6} />
        </Pressable>
      </View>
      {right.map(renderItem)}
    </View>
  );
}
