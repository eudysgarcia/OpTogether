import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useHH } from '../../../api/household';
import { Avatar, Card, Divider, Header, type IconName, ListRow, Screen, SectionHeader, Text } from '../../../components/ui';
import { useTheme } from '../../../theme/ThemeProvider';
import { space } from '../../../theme/tokens';

type Item = { icon: IconName; title: string; subtitle: string; href: string; color?: string };

export default function More() {
  const { colors } = useTheme();
  const { household, me, partner } = useHH();
  const groups: { title: string; items: Item[] }[] = [
    {
      title: 'Hogar',
      items: [
        { icon: 'receipt', title: 'Pagos y servicios', subtitle: 'Vencimientos, pagos parciales y comprobantes', href: '/payments' },
        { icon: 'calendar-days', title: 'Calendario', subtitle: 'Pagos, cuotas, aportes y recordatorios', href: '/calendar' },
        { icon: 'card', title: 'Deudas', subtitle: 'Saldos, abonos y planificador', href: '/debts', color: colors.debt },
        { icon: 'piggy-bank', title: 'Ahorros', subtitle: 'Metas compartidas y progreso', href: '/savings', color: colors.savings },
        { icon: 'wallet', title: 'Fondos y caja chica', subtitle: 'Saldos, reposiciones y transferencias', href: '/funds', color: colors.fund },
        { icon: 'hand-coins', title: 'Aportaciones', subtitle: 'Esperado vs. real de cada uno', href: '/contributions' },
      ],
    },
    {
      title: 'Análisis',
      items: [
        { icon: 'chart', title: 'Reportes', subtitle: 'Gastos, comparaciones y exportación', href: '/reports' },
        { icon: 'calculator', title: 'Simulador', subtitle: 'Escenarios sin tocar datos reales', href: '/simulator' },
        { icon: 'history', title: 'Auditoría', subtitle: 'Quién creó, editó o anuló', href: '/audit' },
      ],
    },
    {
      title: 'Privado',
      items: [{ icon: 'lock', title: 'Mi dinero', subtitle: 'Tus finanzas personales. Solo tú las ves.', href: '/personal' }],
    },
    {
      title: 'Cuenta',
      items: [
        { icon: 'bell', title: 'Notificaciones', subtitle: 'Alertas y recordatorios', href: '/notifications' },
        { icon: 'settings', title: 'Configuración', subtitle: 'Hogar, categorías, ingresos, tema y seguridad', href: '/settings' },
      ],
    },
  ];
  return (
    <Screen testID="screen-more" header={<Header title="Más" large />}>
      <Card onPress={() => router.push('/settings/household')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <View style={{ flexDirection: 'row' }}>
            {me && <Avatar name={me.display_name} color={me.color} size={44} />}
            {partner && <View style={{ marginLeft: -12, borderWidth: 2, borderColor: colors.surface, borderRadius: 26 }}><Avatar name={partner.display_name} color={partner.color} size={44} /></View>}
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="h3">{household?.name}</Text>
            <Text variant="caption" color="textSecondary">{[me?.display_name, partner?.display_name].filter(Boolean).join(' y ')}{partner && !partner.user_id ? ' (pendiente de unirse)' : ''}</Text>
          </View>
        </View>
      </Card>
      {groups.map((g) => (
        <View key={g.title}>
          <SectionHeader title={g.title} />
          <Card>
            {g.items.map((it, i) => (
              <View key={it.href}>
                {i > 0 && <Divider inset={52} />}
                <ListRow testID={`more-${it.href}`} icon={it.icon} iconColor={it.color} title={it.title} subtitle={it.subtitle} onPress={() => router.push(it.href as never)} />
              </View>
            ))}
          </Card>
        </View>
      ))}
    </Screen>
  );
}
