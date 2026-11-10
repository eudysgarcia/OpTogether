import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { elevation, radius, space } from '../../theme/tokens';
import { useToast } from '../../store/toast';
import { useOnline } from '../../lib/network';
import { useOutbox } from '../../store/outbox';
import { Button } from './Button';
import { Icon } from './Icon';
import { Input } from './Inputs';
import { Pressable } from './Pressable';
import { Sheet } from './Sheet';
import { Text } from './Text';

export function Toaster() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { toasts, dismiss } = useToast();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + space[2], left: space[4], right: space[4], gap: space[2], zIndex: 1000 }}>
      {toasts.map((t) => {
        const fg = t.tone === 'success' ? colors.positive : t.tone === 'error' ? colors.negative : colors.brand;
        const icon = t.tone === 'success' ? 'check-circle' : t.tone === 'error' ? 'alert-circle' : 'info';
        return (
          <Animated.View key={t.id} entering={FadeInUp.springify().damping(18)} exiting={FadeOutUp.duration(160)} layout={LinearTransition}>
            <Pressable
              onPress={() => dismiss(t.id)}
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              style={{ flexDirection: 'row', gap: space[3], padding: space[4], borderRadius: radius.md, backgroundColor: colors.surfaceRaised, borderLeftWidth: 4, borderLeftColor: fg, ...elevation.lg }}
            >
              <Icon name={icon} size={20} color={fg} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{t.title}</Text>
                {t.message && <Text variant="caption" color="textSecondary">{t.message}</Text>}
              </View>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

export function OfflineBanner() {
  const online = useOnline();
  const pending = useOutbox((s) => s.items.length);
  const { colors } = useTheme();
  if (online && !pending) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: space[4], paddingVertical: space[2], backgroundColor: online ? colors.brandSoft : colors.warningSoft }}
    >
      <Icon name={online ? 'refresh' : 'cloud-off'} size={16} color={online ? colors.brand : colors.warning} />
      <Text variant="caption" color="text" style={{ flex: 1 }}>
        {online
          ? `Sincronizando ${pending} movimiento(s) pendiente(s)…`
          : `Sin conexión · Mostrando datos guardados${pending ? ` · ${pending} pendiente(s) por sincronizar` : ''}`}
      </Text>
    </View>
  );
}

/** Confirmación con motivo obligatorio (anulaciones, ajustes). Nunca hay cambios silenciosos. */
export function ConfirmSheet({
  visible, onClose, title, message, confirmLabel = 'Confirmar', danger, requireReason, loading, onConfirm, reasonPlaceholder,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  requireReason?: boolean;
  loading?: boolean;
  onConfirm: (reason: string) => void;
  reasonPlaceholder?: string;
}) {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string>();
  useEffect(() => {
    if (visible) {
      setReason('');
      setErr(undefined);
    }
  }, [visible]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button
            title={confirmLabel}
            variant={danger ? 'danger' : 'primary'}
            loading={loading}
            onPress={() => {
              if (requireReason && reason.trim().length < 3) {
                setErr('Indica un motivo (mínimo 3 caracteres).');
                return;
              }
              onConfirm(reason.trim());
            }}
          />
          <Button title="Cancelar" variant="ghost" onPress={onClose} />
        </>
      }
    >
      {message && <Text variant="body" color="textSecondary">{message}</Text>}
      {requireReason && (
        <Input label="Motivo" required value={reason} onChangeText={setReason} placeholder={reasonPlaceholder ?? 'Ej.: Registrado por error'} error={err} maxLength={300} />
      )}
    </Sheet>
  );
}
