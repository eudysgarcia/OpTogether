import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { Share, View } from 'react-native';
import { useFinanceMutation } from '../../../api/finance';
import { useHH } from '../../../api/household';
import { Avatar, Banner, Button, Card, Divider, Header, Input, Screen, SectionHeader, Sheet, StatusPill, Switch, Text } from '../../../components/ui';
import { db, unwrap } from '../../../lib/api';
import { toast } from '../../../store/toast';
import { useTheme } from '../../../theme/ThemeProvider';
import { radius, space } from '../../../theme/tokens';
import type { Member } from '../../../types/models';

export default function Members() {
  const { colors } = useTheme();
  const { members, me, isAdmin } = useHH();
  const [code, setCode] = useState<string | null>(null);
  const [edit, setEdit] = useState<Member | null>(null);
  const [name, setName] = useState('');
  const invite = useFinanceMutation(async (memberId: string | null) => unwrap(await db.rpc('create_invite', { p_member: memberId ?? undefined })), { onSuccess: (c) => setCode(c as string) });
  const [admin, setAdmin] = useState(false);
  const rename = useFinanceMutation(async () => {
    const patch: { display_name: string; role?: 'admin' | 'member' } = { display_name: name.trim() };
    if (isAdmin && edit!.id !== me?.id && edit!.user_id) patch.role = admin ? 'admin' : 'member';
    return unwrap(await db.from('household_members').update(patch).eq('id', edit!.id).select('id'));
  }, { success: 'Miembro actualizado', onSuccess: () => setEdit(null) });
  const pending = members.find((m) => !m.user_id);
  return (
    <Screen header={<Header title="Miembros" back />}>
      {pending && isAdmin && <Banner tone="warning" title={`${pending.display_name} aún no se ha unido`} message="Genera un código y compártelo. Es válido 7 días y se usa una vez." />}
      <Card>
        {members.map((m, i) => (
          <View key={m.id}>
            {i > 0 && <Divider inset={56} />}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3] }}>
              <Avatar name={m.display_name} color={m.color} size={44} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="bodyStrong">{m.display_name}{m.id === me?.id ? ' (tú)' : ''}</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <StatusPill small label={m.role === 'admin' ? 'Administrador' : 'Miembro'} tone={m.role === 'admin' ? 'brand' : 'neutral'} icon={m.role === 'admin' ? 'shield' : 'user'} />
                  {!m.user_id && <StatusPill small label="Pendiente" tone="warning" icon="clock" />}
                </View>
              </View>
              {(isAdmin || m.id === me?.id) && <Button title="Editar" size="sm" variant="ghost" full={false} onPress={() => { setEdit(m); setName(m.display_name); setAdmin(m.role === 'admin'); }} />}
            </View>
            {!m.user_id && isAdmin && <Button title={`Invitar a ${m.display_name}`} icon="user-plus" size="md" loading={invite.isPending} onPress={() => invite.mutate(m.id)} />}
          </View>
        ))}
      </Card>
      <SectionHeader title="Permisos" />
      <Card>
        <Text variant="body">Ambos pueden gestionar las finanzas compartidas. El administrador además puede invitar, editar el hogar y eliminar comprobantes de otros.</Text>
        <Text variant="body" style={{ marginTop: space[2] }}>Nadie puede ver las finanzas personales del otro.</Text>
      </Card>
      <Sheet visible={!!code} onClose={() => setCode(null)} title="Código de invitación">
        <View style={{ alignItems: 'center', padding: space[5], borderRadius: radius.lg, backgroundColor: colors.brandSoft }}>
          <Text variant="display" color="brand" style={{ letterSpacing: 6 }} selectable>{code}</Text>
          <Text variant="caption" color="textSecondary">Válido por 7 días · un solo uso</Text>
        </View>
        <Text variant="body" color="textSecondary">Tu pareja debe crear su cuenta, elegir “Tengo un código de invitación” e introducir este código.</Text>
        <Button title="Copiar" icon="copy" variant="secondary" onPress={async () => { await Clipboard.setStringAsync(code ?? ''); toast.success('Código copiado'); }} />
        <Button title="Compartir" icon="share" onPress={() => Share.share({ message: `Únete a nuestro hogar en OpTogether con el código: ${code}` })} />
      </Sheet>
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title="Editar miembro" footer={<Button title="Guardar" disabled={!name.trim()} loading={rename.isPending} onPress={() => rename.mutate(undefined as never)} />}>
        <Input label="Nombre" value={name} onChangeText={setName} maxLength={40} />
        {isAdmin && edit && edit.id !== me?.id && edit.user_id && (
          <Switch label="Administrador del hogar" description="Puede invitar, editar el hogar y gestionar roles. Nunca ve tus finanzas personales." value={admin} onChange={setAdmin} />
        )}
      </Sheet>
    </Screen>
  );
}
