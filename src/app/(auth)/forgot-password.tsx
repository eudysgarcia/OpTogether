import * as Linking from 'expo-linking';
import React, { useState } from 'react';
import { Banner, Button, Header, Input, Screen, Text } from '../../components/ui';
import { errorMessage } from '../../lib/errors';
import { supabase } from '../../lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  return (
    <Screen header={<Header title="Recuperar contraseña" back />}>
      <Text variant="body" color="textSecondary">Te enviaremos un enlace para crear una contraseña nueva. Ábrelo desde este teléfono.</Text>
      {sent && <Banner tone="success" title="Enlace enviado" message="Si el correo existe, recibirás el enlace en unos minutos." />}
      {error && <Banner tone="danger" title="No se pudo enviar" message={error} />}
      <Input label="Correo electrónico" icon="mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Button
        title="Enviar enlace"
        loading={loading}
        disabled={!/\S+@\S+\.\S+/.test(email)}
        onPress={async () => {
          setLoading(true);
          setError(undefined);
          const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: Linking.createURL('/reset-password') });
          setLoading(false);
          if (e) setError(errorMessage(e));
          else setSent(true);
        }}
      />
    </Screen>
  );
}
