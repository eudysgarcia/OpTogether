import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useOnline } from '../../lib/network';
import { registerPush, routeFromNotification, syncLocalReminders } from '../../lib/notifications';
import { flushOutbox, useBillCycles } from '../../api/finance';
import { OfflineBanner } from '../../components/ui';
import { usePrefs } from '../../store/prefs';
import { useOutbox } from '../../store/outbox';
import { useTheme } from '../../theme/ThemeProvider';
import { addDaysISO, todayISO } from '../../lib/dates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const unstable_settings = { anchor: '(tabs)' };

export default function AppLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const pending = useOutbox((s) => s.items.length);
  const localReminders = usePrefs((s) => s.localReminders);
  const cycles = useBillCycles({ from: addDaysISO(todayISO(), -10), to: addDaysISO(todayISO(), 35) });
  const registered = useRef(false);

  // Push: registro único por sesión + navegación al tocar una notificación
  useEffect(() => {
    if (!registered.current) {
      registered.current = true;
      registerPush();
    }
    const sub = Notifications.addNotificationResponseReceivedListener((r) =>
      routeFromNotification(r.notification.request.content.data as Record<string, unknown>),
    );
    return () => sub.remove();
  }, []);

  // Recordatorios locales de respaldo
  useEffect(() => {
    if (cycles.data) syncLocalReminders(cycles.data, localReminders);
  }, [cycles.data, localReminders]);

  // Sincronización de movimientos guardados sin conexión
  useEffect(() => {
    if (online && pending) flushOutbox();
  }, [online, pending]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {(!online || pending > 0) && <View style={{ paddingTop: insets.top, backgroundColor: colors.background }}><OfflineBanner /></View>}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="transaction/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </View>
  );
}
