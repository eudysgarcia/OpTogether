import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { Banner, Button, Input, Screen, Text } from '../components/ui';
import { useBackend } from '../store/backend';
import { space } from '../theme/tokens';

/** Solo aparece si el APK se compiló sin las variables del servidor. */
export default function Connect() {
  const setBackend = useBackend((s) => s.setBackend);
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string>();
  return (
    <Screen
      footer={
        <Button
          title="Conectar"
          icon="check"
          onPress={() => {
            if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url.trim().replace(/\/+$/, '')) && !/^https?:\/\//.test(url.trim())) {
              setError('Introduce la URL del proyecto (https://xxxx.supabase.co).');
              return;
            }
            if (key.trim().length < 30) {
              setError('La clave pública (anon) no parece válida.');
              return;
            }
            setBackend(url, key);
          }}
        />
      }
    >
      <View style={{ alignItems: 'center', gap: space[3], marginTop: space[8] }}>
        <Image source={require('../../assets/brand/isotype.png')} style={{ width: 88, height: 88 }} resizeMode="contain" />
        <Text variant="h1" align="center">Conecta tu servidor</Text>
        <Text variant="body" color="textSecondary" align="center">
          Esta instalación aún no tiene configurado el servidor de OpTogether. Solo se hace una vez.
        </Text>
      </View>
      <Banner tone="info" title="¿Dónde lo encuentro?" message="Supabase → Project Settings → API: copia la Project URL y la clave pública (anon / publishable). Nunca uses la service_role." />
      <Input label="URL del proyecto" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" placeholder="https://xxxx.supabase.co" icon="building" />
      <Input label="Clave pública (anon)" value={key} onChangeText={setKey} autoCapitalize="none" placeholder="eyJhbGciOi…" icon="key" error={error} />
    </Screen>
  );
}
