import React, { useState } from 'react';
import { Banner, Button, Header, Input, Screen, Text } from '../../components/ui';
import { auth } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { toast } from '../../store/toast';

/** Recuperación en dos pasos: código de 6 dígitos por correo → nueva contraseña. */
export default function ForgotPassword() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const run = async (fn: () => Promise<unknown>) => {
    setLoading(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  return (
    <Screen header={<Header title="Recuperar contraseña" back />}>
      {error && <Banner tone="danger" title="No se pudo completar" message={error} />}
      {step === 'email' ? (
        <>
          <Text variant="body" color="textSecondary">Te enviaremos un código de 6 dígitos a tu correo.</Text>
          <Input label="Correo electrónico" icon="mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Button title="Enviar código" loading={loading} disabled={!/\S+@\S+\.\S+/.test(email)}
            onPress={() => run(async () => { await auth.requestRecoveryCode(email.trim().toLowerCase()); setStep('code'); })} />
        </>
      ) : (
        <>
          <Banner tone="info" title="Revisa tu correo" message={`Si ${email} tiene cuenta, recibirás un código válido por 15 minutos.`} />
          <Input label="Código" icon="key" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6}
            style={{ letterSpacing: 6, fontFamily: 'Manrope_700Bold', fontSize: 20 }} />
          <Input label="Contraseña nueva" icon="lock" secureTextEntry value={pw} onChangeText={setPw} helper="Mínimo 8 caracteres, con letras y números." autoComplete="new-password" />
          <Input label="Confirmar contraseña" icon="lock" secureTextEntry value={pw2} onChangeText={setPw2} error={pw2 && pw !== pw2 ? 'No coinciden' : undefined} />
          <Button title="Cambiar contraseña" loading={loading} disabled={code.length !== 6 || pw.length < 8 || !/\d/.test(pw) || pw !== pw2}
            onPress={() => run(async () => { await auth.resetWithCode(email.trim().toLowerCase(), code, pw); toast.success('Contraseña actualizada'); })} />
          <Button title="Reenviar código" variant="ghost" disabled={loading} onPress={() => run(() => auth.requestRecoveryCode(email.trim().toLowerCase()))} />
        </>
      )}
    </Screen>
  );
}
