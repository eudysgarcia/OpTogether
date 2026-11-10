import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { db } from './api';
import type { BillCycleRow } from '../types/models';
import { addDaysISO, parseISODate, todayISO } from './dates';
import { formatMoney } from './money';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Recordatorios de pagos',
      description: 'Vencimientos de servicios, cuotas y alertas de presupuesto',
      // eslint-disable-next-line import/namespace -- enum re-exportado (falso positivo)
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#7C3AED',
    });
  }
}

/**
 * Registra el token push del dispositivo en el backend. Requiere permisos y, en Android,
 * credenciales FCM configuradas en EAS. Si no están disponibles, la app sigue funcionando
 * con notificaciones internas + recordatorios locales.
 */
export async function registerPush(): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (!Device.isDevice) return { ok: false, reason: 'Emulador' };
    await ensureChannel();
    const perm = await Notifications.getPermissionsAsync();
    let status = perm.status;
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return { ok: false, reason: 'Permiso denegado' };
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) return { ok: false, reason: 'Proyecto EAS no configurado' };
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const { error } = await db.rpc('register_push_token', { p_token: token, p_platform: Platform.OS === 'ios' ? 'ios' : 'android' });
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

export function routeFromNotification(data: Record<string, unknown> | undefined) {
  const route = typeof data?.route === 'string' ? data.route : null;
  if (route && route.startsWith('/')) router.push(route as never);
}

const LOCAL_PREFIX = 'optogether-bill-';

/**
 * Respaldo local: programa recordatorios en el teléfono para los próximos vencimientos.
 * Se reprograma en cada sincronización, por lo que un ciclo pagado deja de notificarse.
 * El backend (pg_cron) sigue siendo la fuente principal.
 */
export async function syncLocalReminders(cycles: BillCycleRow[], enabled: boolean) {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled.filter((n) => n.identifier.startsWith(LOCAL_PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
    if (!enabled) return;
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') return;
    await ensureChannel();
    const today = todayISO();
    const horizon = addDaysISO(today, 30);
    const now = Date.now();
    for (const c of cycles) {
      if (!c.id || !c.due_date || !['pending', 'due_soon', 'partial', 'overdue'].includes(c.status ?? '')) continue;
      if (c.due_date > horizon) continue;
      for (const offset of [5, 1, 0]) {
        const day = addDaysISO(c.due_date, -offset);
        const at = parseISODate(day);
        at.setHours(9, 0, 0, 0);
        if (at.getTime() <= now) continue;
        const pending = Math.max(Number(c.expected_amount ?? 0) - Number(c.paid_amount ?? 0), 0);
        await Notifications.scheduleNotificationAsync({
          identifier: `${LOCAL_PREFIX}${c.id}-${offset}`,
          content: {
            title: `${c.bill_name} ${offset === 0 ? 'vence hoy' : offset === 1 ? 'vence mañana' : `vence en ${offset} días`}`,
            body: `Pendiente: ${formatMoney(pending)}`,
            data: { route: `/payments/${c.bill_id}` },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'reminders' },
        });
      }
    }
  } catch {
    /* notificaciones locales no disponibles */
  }
}
