import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useHH } from '../../../api/household';
import { Banner, Button, Card, ConfirmSheet, Divider, Header, type IconName, ListRow, Screen, SectionHeader, Segmented, Switch, Text } from '../../../components/ui';
import { registerPush } from '../../../lib/notifications';
import { supabase } from '../../../lib/supabase';
import { queryClient } from '../../../lib/queryClient';
import { usePrefs, type ThemePreference } from '../../../store/prefs';
import { toast } from '../../../store/toast';
import { space } from '../../../theme/tokens';

export default function Settings() {
  const { isAdmin } = useHH();
  const prefs = usePrefs();
  const [signOut, setSignOut] = useState(false);
  const [pushMsg, setPushMsg] = useState<string>();
  const items: { icon: IconName; title: string; subtitle: string; href: string }[] = [
    { icon: 'home', title: 'Hogar', subtitle: 'Nombre y moneda', href: '/settings/household' },
    { icon: 'users', title: 'Miembros e invitaciones', subtitle: isAdmin ? 'Invita y gestiona roles' : 'Ver miembros', href: '/settings/members' },
    { icon: 'cash', title: 'Ingresos', subtitle: 'Ingreso mensual de cada uno', href: '/settings/incomes' },
    { icon: 'tag', title: 'Categorías', subtitle: 'Categorías y subcategorías', href: '/settings/categories' },
    { icon: 'card', title: 'Métodos de pago', subtitle: 'Efectivo, tarjetas, transferencias', href: '/settings/payment-methods' },
    { icon: 'pie', title: 'Presupuestos y distribuciones', subtitle: 'Montos y % por categoría', href: '/budget' },
    { icon: 'wallet', title: 'Fondos', subtitle: 'Caja chica, salidas, común…', href: '/funds' },
    { icon: 'receipt', title: 'Servicios y recordatorios', subtitle: 'Fechas y avisos por servicio', href: '/payments' },
  ];
  return (
    <Screen testID="screen-settings" header={<Header title="Configuración" back />}>
      <Card>
        {items.map((it, i) => (
          <View key={it.href}>
            {i > 0 && <Divider inset={52} />}
            <ListRow icon={it.icon} title={it.title} subtitle={it.subtitle} onPress={() => router.push(it.href as never)} />
          </View>
        ))}
      </Card>

      <View>
        <SectionHeader title="Preferencias" />
        <Card>
          <View style={{ gap: space[3] }}>
            <Text variant="label" color="textSecondary">Tema</Text>
            <Segmented<ThemePreference> options={[{ value: 'system', label: 'Sistema' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }]} value={prefs.theme} onChange={prefs.setTheme} />
            <Divider />
            <Switch label="Ocultar montos" description="Muestra RD$••••• en pantallas (útil en público)." value={prefs.hideAmounts} onChange={() => prefs.toggleHideAmounts()} />
            <Divider />
            <Switch label="Recordatorios en este teléfono" description="Respaldo local de los avisos de pago (además del servidor)." value={prefs.localReminders} onChange={prefs.setLocalReminders} />
            <Button title="Activar notificaciones push" icon="bell" variant="secondary" size="md" onPress={async () => {
              const r = await registerPush();
              setPushMsg(r.ok ? 'Push activadas en este dispositivo.' : `No disponibles: ${r.reason}. Seguirás viendo las notificaciones dentro de la app.`);
              if (r.ok) toast.success('Notificaciones activadas');
            }} />
            {pushMsg && <Text variant="caption" color="textSecondary">{pushMsg}</Text>}
          </View>
        </Card>
      </View>

      <View>
        <SectionHeader title="Seguridad" />
        <Card>
          <ListRow icon="key" title="Cambiar contraseña" onPress={() => router.push('/settings/security')} />
          <Divider inset={52} />
          <ListRow icon="logout" title="Cerrar sesión" danger onPress={() => setSignOut(true)} />
        </Card>
        <Banner tone="info" icon="shield-check" title="Tus datos están protegidos" message="Cada consulta se valida en el servidor con políticas de seguridad por fila. Los comprobantes son privados y se abren con enlaces temporales." />
      </View>
      <Text variant="caption" color="textTertiary" align="center">OpTogether v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
      <ConfirmSheet visible={signOut} onClose={() => setSignOut(false)} title="Cerrar sesión" message="Los datos guardados en este teléfono se borrarán. Tus datos siguen seguros en el servidor." confirmLabel="Cerrar sesión" danger
        onConfirm={async () => { setSignOut(false); queryClient.clear(); await supabase.auth.signOut(); }} />
    </Screen>
  );
}
