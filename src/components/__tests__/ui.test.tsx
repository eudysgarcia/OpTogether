import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AmountInput, Button, ConfirmSheet, EmptyState, Money, StatusPill } from '../ui';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { usePrefs } from '../../store/prefs';

const wrap = (ui: React.ReactElement) =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemeProvider>{ui}</ThemeProvider>
    </SafeAreaProvider>,
  );

describe('UI', () => {
  it('estado vacío con acción', async () => {
    const onAction = jest.fn();
    await wrap(<EmptyState icon="receipt" title="Sin movimientos" message="Registra el primero" action="Registrar" onAction={onAction} />);
    expect(screen.getByText('Sin movimientos')).toBeTruthy();
    await fireEvent.press(screen.getByText('Registrar'));
    expect(onAction).toHaveBeenCalled();
  });

  it('botón deshabilitado no ejecuta la acción', async () => {
    const onPress = jest.fn();
    await wrap(<Button title="Guardar" disabled onPress={onPress} />);
    await fireEvent.press(screen.getByText('Guardar'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('el monto solo acepta números y separadores', async () => {
    const onChange = jest.fn();
    await wrap(<AmountInput value="" onChange={onChange} testID="amt" />);
    await fireEvent.changeText(screen.getByTestId('amt'), 'RD$ 1,250.5a');
    expect(onChange).toHaveBeenCalledWith('1,250.5');
  });

  it('formatea RD$ y respeta el modo ocultar montos', async () => {
    await wrap(<Money value={58730} testID="m" />);
    expect(screen.getByText('RD$58,730.00')).toBeTruthy();
    usePrefs.setState({ hideAmounts: true });
    await wrap(<Money value={58730} />);
    expect(screen.getByText('RD$•••••')).toBeTruthy();
    usePrefs.setState({ hideAmounts: false });
  });

  it('el estado no depende solo del color (texto accesible)', async () => {
    await wrap(<StatusPill label="Excedido" tone="negative" icon="alert" />);
    expect(screen.getByLabelText('Estado: Excedido')).toBeTruthy();
  });

  it('la anulación exige motivo', async () => {
    const onConfirm = jest.fn();
    await wrap(<ConfirmSheet visible onClose={() => {}} title="Anular movimiento" requireReason confirmLabel="Anular" onConfirm={onConfirm} />);
    await fireEvent.press(screen.getByText('Anular'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Indica un motivo (mínimo 3 caracteres).')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Motivo'), 'Registrado por error');
    await fireEvent.press(screen.getByText('Anular'));
    expect(onConfirm).toHaveBeenCalledWith('Registrado por error');
  });
});
