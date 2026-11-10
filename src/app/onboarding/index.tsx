import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { Isotype } from '../../components/brand/Logo';
import { Button, Card, Icon, Screen, Text } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';

export default function OnboardingStart() {
  const { colors } = useTheme();
  return (
    <Screen testID="screen-onboarding">
      <View style={{ alignItems: 'center', gap: space[3], marginTop: space[10] }}>
        <Isotype size={84} />
        <Text variant="h1" align="center">Bienvenido a OpTogether</Text>
        <Text variant="body" color="textSecondary" align="center">
          Organicen juntos el presupuesto, los pagos y los ahorros del hogar. Cada uno conserva sus finanzas personales en privado.
        </Text>
      </View>
      <Card onPress={() => router.push('/onboarding/create')} testID="opt-create">
        <View style={{ flexDirection: 'row', gap: space[4], alignItems: 'center' }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="home" color={colors.onBrand} size={24} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="h3">Crear nuestro hogar</Text>
            <Text variant="caption" color="textSecondary">Configura ingresos, presupuesto y distribución. Luego invitas a tu pareja.</Text>
          </View>
          <Icon name="chevron-right" color={colors.textTertiary} />
        </View>
      </Card>
      <Card onPress={() => router.push('/onboarding/join')} testID="opt-join">
        <View style={{ flexDirection: 'row', gap: space[4], alignItems: 'center' }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="user-plus" color={colors.onAccent} size={24} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="h3">Tengo un código de invitación</Text>
            <Text variant="caption" color="textSecondary">Únete al hogar que ya creó tu pareja.</Text>
          </View>
          <Icon name="chevron-right" color={colors.textTertiary} />
        </View>
      </Card>
      <Button title="Cerrar sesión" variant="ghost" icon="logout" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}
