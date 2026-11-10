import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Banner, Button, Header, Input, Loading, Screen } from '../components/ui';
import { errorMessage } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { toast } from '../store/toast';

/** Destino del enlace de recuperación (optogether://reset-password?code=...). */
export default function ResetPassword() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (code) {
        const { error: e } = await supabase.auth.exchangeCodeForSession(code);
        if (e) setError('El enlace expiró o ya fue usado. Solicita uno nuevo.');
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session && !code) setError('Abre el enlace que recibiste por correo para cambiar tu contraseña.');
      setReady(true);
    })();
  }, [code]);

  if (!ready) return <Screen><Loading label="Verificando enlace…" /></Screen>;

  return (
    <Screen header={<Header title="Nueva contraseña" back onBack={() => router.replace('/')} />}>
      {error && <Banner tone="danger" title="No se puede continuar" message={error} />}
      <Input label="Contraseña nueva" icon="lock" secureTextEntry value={pw} onChangeText={setPw} helper="Mínimo 8 caracteres, con letras y números." />
      <Input label="Confirmar contraseña" icon="lock" secureTextEntry value={pw2} onChangeText={setPw2} error={pw2 && pw !== pw2 ? 'No coinciden' : undefined} />
      <Button
        title="Guardar contraseña"
        loading={saving}
        disabled={!!error || pw.length < 8 || !/\d/.test(pw) || pw !== pw2}
        onPress={async () => {
          setSaving(true);
          const { error: e } = await supabase.auth.updateUser({ password: pw });
          setSaving(false);
          if (e) return setError(errorMessage(e));
          toast.success('Contraseña actualizada');
          router.replace('/');
        }}
      />
    </Screen>
  );
}
