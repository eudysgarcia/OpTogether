import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useMarkNotificationsRead, useNotifications } from '../../api/finance';
import { Card, EmptyState, ErrorState, Header, Icon, type IconName, ListSkeleton, Pressable, Screen, Text } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';

const KIND: Record<string, { icon: IconName; tone: 'negative' | 'warning' | 'brand' | 'debt' }> = {
  bill_due: { icon: 'receipt', tone: 'brand' }, bill_overdue: { icon: 'alert-circle', tone: 'negative' }, budget_exceeded: { icon: 'alert-circle', tone: 'negative' },
  budget_near_limit: { icon: 'alert', tone: 'warning' }, debt_due: { icon: 'card', tone: 'debt' }, reminder: { icon: 'bell', tone: 'brand' },
};

export default function Notifications() {
  const { colors } = useTheme();
  const q = useNotifications();
  const mark = useMarkNotificationsRead();
  const unread = (q.data ?? []).filter((n) => !n.read_at).map((n) => n.id);
  useEffect(() => {
    if (unread.length) {
      const t = setTimeout(() => mark.mutate(unread), 1500);
      return () => clearTimeout(t);
    }
  }, [unread.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Screen testID="screen-notifications" header={<Header title="Notificaciones" back />} refreshing={q.isRefetching} onRefresh={q.refetch}>
      {q.isPending ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : q.data?.length ? (
        <Card>
          {q.data.map((n) => {
            const k = KIND[n.kind] ?? { icon: 'bell' as IconName, tone: 'brand' as const };
            const color = k.tone === 'negative' ? colors.negative : k.tone === 'warning' ? colors.warning : k.tone === 'debt' ? colors.debt : colors.brand;
            const route = (n.data as { route?: string })?.route;
            return (
              <Pressable key={n.id} onPress={route ? () => router.push(route as never) : undefined} scaleTo={0.985} style={{ flexDirection: 'row', gap: space[3], paddingVertical: space[3] }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: `${color}1A`, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={k.icon} size={18} color={color} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong">{n.title}</Text>
                  <Text variant="caption" color="textSecondary">{n.body}</Text>
                  <Text variant="caption" color="textTertiary">{new Date(n.created_at).toLocaleString('es-DO')}</Text>
                </View>
                {!n.read_at && <View accessibilityLabel="No leída" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 6 }} />}
              </Pressable>
            );
          })}
        </Card>
      ) : <EmptyState icon="bell" title="Sin notificaciones" message="Aquí verás recordatorios de pagos, cuotas y alertas de presupuesto." />}
    </Screen>
  );
}
