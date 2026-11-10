import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';
import { Isotype, Wordmark } from '../../components/brand/Logo';
import { Banner, Button, Input, Screen, Text } from '../../components/ui';
import { errorMessage } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { space } from '../../theme/tokens';

const schema = z.object({
  email: z.string().trim().email('Correo no válido'),
  password: z.string().min(1, 'Introduce tu contraseña'),
});

export default function SignIn() {
  const [error, setError] = useState<string>();
  const [show, setShow] = useState(false);
  const { control, handleSubmit, formState } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (v) => {
    setError(undefined);
    const { error: e } = await supabase.auth.signInWithPassword({ email: v.email, password: v.password });
    if (e) setError(errorMessage(e));
  });

  return (
    <Screen testID="screen-sign-in">
      <View style={{ alignItems: 'center', gap: space[4], marginTop: space[10], marginBottom: space[4] }}>
        <Isotype size={96} />
        <Wordmark />
      </View>
      <Text variant="h2">Inicia sesión</Text>
      {error && <Banner tone="danger" title="No pudimos iniciar sesión" message={error} />}
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <Input testID="input-email" label="Correo electrónico" icon="mail" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
            autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" error={fieldState.error?.message} />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <Input testID="input-password" label="Contraseña" icon="lock" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
            secureTextEntry={!show} autoComplete="current-password" textContentType="password" error={fieldState.error?.message}
            onSubmitEditing={() => onSubmit()} returnKeyType="go"
            right={<Text variant="label" color="brand" onPress={() => setShow((s) => !s)} accessibilityRole="button">{show ? 'Ocultar' : 'Mostrar'}</Text>} />
        )}
      />
      <Link href="/forgot-password" asChild>
        <Text variant="label" color="brand" accessibilityRole="link" style={{ alignSelf: 'flex-end', paddingVertical: 6 }}>¿Olvidaste tu contraseña?</Text>
      </Link>
      <Button testID="btn-sign-in" title="Entrar" onPress={() => onSubmit()} loading={formState.isSubmitting} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space[2] }}>
        <Text variant="body" color="textSecondary">¿No tienes cuenta?</Text>
        <Link href="/sign-up" asChild>
          <Text variant="bodyStrong" color="brand" accessibilityRole="link">Crear cuenta</Text>
        </Link>
      </View>
    </Screen>
  );
}
