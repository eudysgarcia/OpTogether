import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Banner, Button, Header, Input, Screen, Text } from '../../components/ui';
import { errorMessage } from '../../lib/errors';
import { auth } from '../../lib/api';

const schema = z
  .object({
    email: z.string().trim().email('Correo no válido'),
    password: z.string().min(8, 'Mínimo 8 caracteres').regex(/[A-Za-z]/, 'Incluye letras').regex(/\d/, 'Incluye al menos un número'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'Las contraseñas no coinciden', path: ['confirm'] });

export default function SignUp() {
  const [error, setError] = useState<string>();
  const { control, handleSubmit, formState } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', password: '', confirm: '' } });

  const onSubmit = handleSubmit(async (v) => {
    setError(undefined);
    try {
      await auth.signUp(v.email.trim().toLowerCase(), v.password);
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <Screen header={<Header title="Crear cuenta" back />}>
      <Text variant="body" color="textSecondary">
        Cada persona del hogar usa su propia cuenta. Tus finanzas personales siempre serán privadas.
      </Text>
      {error && <Banner tone="danger" title="No pudimos crear la cuenta" message={error} />}
      <Controller control={control} name="email" render={({ field, fieldState }) => (
        <Input label="Correo electrónico" icon="mail" value={field.value} onChangeText={field.onChange} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={fieldState.error?.message} />
      )} />
      <Controller control={control} name="password" render={({ field, fieldState }) => (
        <Input label="Contraseña" icon="lock" value={field.value} onChangeText={field.onChange} secureTextEntry autoComplete="new-password" helper="Mínimo 8 caracteres, con letras y números." error={fieldState.error?.message} />
      )} />
      <Controller control={control} name="confirm" render={({ field, fieldState }) => (
        <Input label="Confirmar contraseña" icon="lock" value={field.value} onChangeText={field.onChange} secureTextEntry autoComplete="new-password" error={fieldState.error?.message} />
      )} />
      <Button title="Crear cuenta" onPress={() => onSubmit()} loading={formState.isSubmitting} />
    </Screen>
  );
}
