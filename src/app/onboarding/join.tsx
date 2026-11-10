import React, { useState } from 'react';
import { Banner, Button, Header, Input, Screen, Text } from '../../components/ui';
import { useAcceptInvite } from '../../api/household';
import { errorMessage } from '../../lib/errors';
import { queryClient } from '../../lib/queryClient';
import { toast } from '../../store/toast';

export default function Join() {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const accept = useAcceptInvite();
  return (
    <Screen header={<Header title="Unirme a un hogar" back />}>
      <Text variant="body" color="textSecondary">Pide a tu pareja el código desde Configuración → Miembros → Invitar. Es válido por 7 días y se usa una sola vez.</Text>
      {accept.error && <Banner tone="danger" title="No pudimos unirte" message={errorMessage(accept.error)} />}
      <Input
        testID="input-invite-code" label="Código de invitación" icon="key" value={code}
        onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
        autoCapitalize="characters" placeholder="ABCD2345" maxLength={8}
        style={{ letterSpacing: 4, fontFamily: 'Manrope_700Bold', fontSize: 20 }}
      />
      <Input label="¿Cómo quieres aparecer?" icon="user" value={name} onChangeText={setName} placeholder="Tu nombre (opcional)" maxLength={40} />
      <Button
        title="Unirme"
        icon="check"
        disabled={code.length !== 8}
        loading={accept.isPending}
        onPress={() =>
          accept.mutate(
            { code, name: name.trim() || undefined },
            { onSuccess: async () => { toast.success('¡Bienvenido al hogar!'); await queryClient.invalidateQueries({ queryKey: ['household'] }); } },
          )
        }
      />
    </Screen>
  );
}
