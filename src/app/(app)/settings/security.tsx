import { router } from 'expo-router';
import React, { useState } from 'react';
import { Banner, Button, Header, Input, Screen } from '../../../components/ui';
import { errorMessage } from '../../../lib/errors';
import { supabase } from '../../../lib/supabase';
import { toast } from '../../../store/toast';

export default function Security() {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const ok = pw.length >= 8 && /\d/.test(pw) && /[A-Za-z]/.test(pw) && pw === pw2;
  return (
    <Screen header={<Header title="Cambiar contraseña" back />} footer={<Button title="Guardar" disabled={!ok} loading={loading} onPress={async () => {
      setLoading(true);
      const { error: e } = await supabase.auth.updateUser({ password: pw });
      setLoading(false);
      if (e) return setError(errorMessage(e));
      toast.success('Contraseña actualizada');
      router.back();
    }} />}>
      {error && <Banner tone="danger" title="No se pudo cambiar" message={error} />}
      <Input label="Nueva contraseña" secureTextEntry value={pw} onChangeText={setPw} helper="Mínimo 8 caracteres, con letras y números." autoComplete="new-password" />
      <Input label="Confirmar" secureTextEntry value={pw2} onChangeText={setPw2} error={pw2 && pw !== pw2 ? 'No coinciden' : undefined} />
    </Screen>
  );
}
