import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useDebts } from '../../../api/finance';
import { Banner, Card, Divider, EmptyState, Header, Input, KeyValue, Money, Screen, SectionHeader, Segmented, Text } from '../../../components/ui';
import { planDebts, STRATEGY_LABEL, type DebtInput, type Strategy } from '../../../domain/debts';
import { addMonthsISO, formatDate, todayISO, type Frequency } from '../../../lib/dates';
import { formatMoney, parseAmount, sum } from '../../../lib/money';
import { space } from '../../../theme/tokens';
import type { Scope } from '../../../types/models';

export default function DebtPlanner() {
  const { scope = 'household' } = useLocalSearchParams<{ scope?: Scope }>();
  const q = useDebts(scope);
  const [strategy, setStrategy] = useState<Strategy>('avalanche');
  const [extra, setExtra] = useState('0');
  const inputs: DebtInput[] = useMemo(() => (q.data ?? []).filter((d) => Number(d.balance) > 0 && Number(d.installment_amount) > 0).map((d) => ({
    id: d.id!, name: d.name!, balance: Number(d.balance), annualRate: d.interest_rate, payment: Number(d.installment_amount), frequency: (d.frequency === 'one_time' ? 'monthly' : d.frequency) as Frequency,
  })), [q.data]);
  const missing = (q.data ?? []).filter((d) => Number(d.balance) > 0 && !d.installment_amount);
  const extraN = parseAmount(extra) ?? 0;
  const plan = planDebts(inputs, strategy, extraN);
  const other = planDebts(inputs, strategy === 'avalanche' ? 'snowball' : 'avalanche', extraN);
  const noExtra = planDebts(inputs, strategy, 0);
  const today = todayISO();
  const names = new Map(inputs.map((d) => [d.id, d.name]));
  const noRates = inputs.every((d) => !d.annualRate);

  return (
    <Screen header={<Header title="Planificador de deudas" back />}>
      {inputs.length === 0 ? <EmptyState icon="target" title="Sin datos para planificar" message="Registra deudas con cuota para ver proyecciones." /> : (
        <>
          <Card>
            <KeyValue label="Total adeudado"><Money value={sum(inputs.map((d) => d.balance))} variant="amountM" color="debt" /></KeyValue>
            <KeyValue label="Cuotas mínimas al mes"><Money value={sum(inputs.map((d) => d.payment))} variant="amountS" /></KeyValue>
          </Card>
          {noRates && <Banner tone="info" title="Sin tasas registradas" message="Las proyecciones asumen 0% de interés porque no se han registrado tasas (no se inventan)." />}
          {missing.length > 0 && <Banner tone="warning" title="Deudas sin cuota" message={`${missing.map((d) => d.name).join(', ')} no tienen cuota; no se incluyen.`} />}
          <Segmented options={[{ value: 'avalanche', label: STRATEGY_LABEL.avalanche }, { value: 'snowball', label: STRATEGY_LABEL.snowball }]} value={strategy} onChange={setStrategy} />
          <Input label="Abono adicional mensual (RD$)" value={extra} onChangeText={setExtra} keyboardType="decimal-pad" />
          <Card>
            {plan.feasible ? (
              <>
                <Text variant="caption" color="textSecondary">Libres de deudas en</Text>
                <Text variant="amountL">{plan.months} meses</Text>
                <Text variant="caption" color="textSecondary">≈ {formatDate(addMonthsISO(today, plan.months), 'long')}</Text>
                <Divider />
                <KeyValue label="Intereses totales estimados" value={formatMoney(plan.totalInterest)} />
                {extraN > 0 && noExtra.feasible && <KeyValue label="Meses ahorrados por el abono extra" value={`${noExtra.months - plan.months}`} />}
              </>
            ) : <Banner tone="danger" title="Plan inviable" message="Las cuotas no cubren los intereses. Aumenta el abono adicional." />}
          </Card>
          {plan.feasible && (
            <View>
              <SectionHeader title="Orden de liquidación" />
              <Card>
                {plan.order.map((id, i) => (
                  <KeyValue key={id} label={`${i + 1}. ${names.get(id)}`} value={`mes ${plan.payoffMonth[id]}`} />
                ))}
              </Card>
            </View>
          )}
          {plan.feasible && other.feasible && (
            <View>
              <SectionHeader title="Comparación de escenarios" />
              <Card>
                <View style={{ flexDirection: 'row', gap: space[3] }}>
                  {[{ s: strategy, p: plan }, { s: strategy === 'avalanche' ? 'snowball' : 'avalanche', p: other }].map(({ s, p }) => (
                    <View key={s} style={{ flex: 1, gap: 4 }}>
                      <Text variant="label" color="textSecondary">{STRATEGY_LABEL[s as Strategy]}</Text>
                      <Text variant="amountS">{p.months} meses</Text>
                      <Text variant="caption" color="textSecondary">Intereses: {formatMoney(p.totalInterest)}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
