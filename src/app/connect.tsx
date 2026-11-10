import React, { useState } from 'react';
import { View } from 'react-native';
import { Isotype } from '../components/brand/Logo';
import { Banner, Button, Input, Screen, Text } from '../components/ui';
import { health } from '../lib/api';
import { useBackend } from '../store/backend';
import { space } from '../theme/tokens';

/** Solo aparece si el APK se compiló sin EXPO_PUBLIC_API_URL. */
export default function Connect() {
  const setBackend = useBackend((s) => s.setBackend);
  const [url, setUrl] = useState('https://');
  const [error, setError] = useState<string>();
  const [checking, setChecking] = useState(false);
  return (
    <Screen
      footer={
        <Button
          title="Conectar"
          icon="check"
          loading={checking}
          onPress={async () => {
            const clean = url.trim().replace(/\/+$/, '');
            if (!/^https?:\/\/[^\s]+$/.test(clean)) return setError('Introduce la dirección completa, p. ej. https://finanzas.tu-dominio.com');
            setChecking(true);
            const ok = await health(clean);
            setChecking(false);
            if (!ok) return setError('No pudimos conectar con ese servidor. Revisa la dirección y tu conexión.');
            setBackend(clean);
          }}
        />
      }
    >
      <View style={{ alignItems: 'center', gap: space[3], marginTop: space[8] }}>
        <Isotype size={88} />
        <Text variant="h1" align="center">Conecta tu servidor</Text>
        <Text variant="body" color="textSecondary" align="center">Esta instalación aún no conoce la dirección del servidor de OpTogether. Solo se hace una vez.</Text>
      </View>
      <Banner tone="info" title="¿Cuál es la dirección?" message="Es la URL pública del servidor donde se instaló el backend (PUBLIC_URL en el archivo .env del servidor)." />
      <Input label="Dirección del servidor" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://finanzas.tu-dominio.com" icon="building" error={error} />
    </Screen>
  );
}
