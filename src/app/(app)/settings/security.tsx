import { router } from 'expo-router';
import React, { useState } from 'react';
import { Banner, Button, Header, Input, Screen } from '../../../components/ui';
import { auth } from '../../../lib/api';
import { errorMessage } from '../../../lib/errors';
import { toast } from '../../../store/toast';

export default function Security() {
  const [current, setCurrent] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const ok = current.length > 0 && pw.length >= 8 && /\d/.test(pw) && /[A-Za-z]/.test(pw) && pw === pw2;
  return (
    <Screen header={<Header title="Cambiar contraseña" back />} footer={<Button title="Guardar" disabled={!ok} loading={loading} onPress={async () => {
      setLoading(true);
      setError(undefined);
      try {
        await auth.changePassword(current, pw);
        toast.success('Contraseña actualizada', 'Se cerraron las sesiones en otros dispositivos.');
        router.back();
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setLoading(false);
      }
    }} />}>
      {error && <Banner tone="danger" title="No se pudo cambiar" message={error} />}
      <Input label="Contraseña actual" secureTextEntry value={current} onChangeText={setCurrent} autoComplete="current-password" />
      <Input label="Nueva contraseña" secureTextEntry value={pw} onChangeText={setPw} helper="Mínimo 8 caracteres, con letras y números." autoComplete="new-password" />
      <Input label="Confirmar" secureTextEntry value={pw2} onChangeText={setPw2} error={pw2 && pw !== pw2 ? 'No coinciden' : undefined} />
    </Screen>
  );
}
