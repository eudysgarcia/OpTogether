import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useCreateHousehold } from '../../api/household';
import { Banner, Button, Card, Divider, Header, IconTile, Input, KeyValue, Money, ProgressBar, Screen, Segmented, Text } from '../../components/ui';
import { INITIAL_CATEGORIES, INITIAL_FUNDS, INITIAL_MEMBERS, INITIAL_PAYMENT_METHODS, INITIAL_SAVINGS } from '../../config/initialSetup';
import { errorMessage } from '../../lib/errors';
import { formatMoney, parseAmount, sum } from '../../lib/money';
import { queryClient } from '../../lib/queryClient';
import { toast } from '../../store/toast';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';

const STEPS = ['Personas', 'Presupuesto', 'Ahorro', 'Revisión'];

export default function CreateHousehold() {
  const { colors } = useTheme();
  const create = useCreateHousehold();
  const [step, setStep] = useState(0);
  const [who, setWho] = useState<'0' | '1'>('0');
  const [householdName, setHouseholdName] = useState('Nuestro hogar');
  const [members, setMembers] = useState(INITIAL_MEMBERS.map((m) => ({ ...m, incomeText: String(m.income) })));
  const [cats, setCats] = useState(INITIAL_CATEGORIES.map((c) => ({ ...c, amountText: String(c.amount), pctText: String(c.partnerPct) })));
  const [savings, setSavings] = useState({ name: INITIAL_SAVINGS.name, a: String(INITIAL_SAVINGS.otherAmount), b: String(INITIAL_SAVINGS.partnerAmount) });
  const [dueDays, setDueDays] = useState<Record<string, string>>(
    Object.fromEntries(INITIAL_CATEGORIES.filter((c) => c.bill).map((c) => [c.name, String(c.bill!.due_day)])),
  );

  // Índice 1 de INITIAL_MEMBERS = "pareja A" (Mei); los % de categoría se refieren a ella.
  const meIdx = Number(who);
  const incomes = members.map((m) => parseAmount(m.incomeText) ?? 0);
  const totalIncome = sum(incomes);
  const totalBudget = sum(cats.map((c) => parseAmount(c.amountText) ?? 0));
  const savingsTotal = sum([parseAmount(savings.a) ?? 0, parseAmount(savings.b) ?? 0]);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (members.some((m) => !m.name.trim())) e.push('Escribe el nombre de ambas personas.');
    if (cats.some((c) => parseAmount(c.amountText) === null)) e.push('Revisa los montos del presupuesto.');
    if (cats.some((c) => { const p = Number(c.pctText); return !Number.isFinite(p) || p < 0 || p > 100; })) e.push('Los porcentajes deben estar entre 0 y 100.');
    if (Object.values(dueDays).some((d) => { const n = Number(d); return !Number.isInteger(n) || n < 1 || n > 31; })) e.push('Los días de vencimiento deben estar entre 1 y 31.');
    return e;
  }, [members, cats, dueDays]);

  const submit = () => {
    const keyOf = (idx: number) => (idx === meIdx ? 'me' : 'partner');
    const setup = {
      household_name: householdName.trim() || 'Nuestro hogar',
      members: members.map((m, i) => ({ key: keyOf(i), name: m.name.trim(), income: incomes[i], color: m.color })),
      funds: INITIAL_FUNDS,
      payment_methods: INITIAL_PAYMENT_METHODS,
      categories: cats.map((c) => {
        const pctA = Number(c.pctText); // % del miembro índice 1
        const shares = { [keyOf(1)]: pctA, [keyOf(0)]: 100 - pctA };
        return {
          name: c.name, icon: c.icon, color: c.color, amount: parseAmount(c.amountText) ?? 0, shares,
          is_variable: c.is_variable, kind: c.kind, fund_key: c.fund_key,
          bill: c.bill ? { ...c.bill, due_day: Number(dueDays[c.name] ?? c.bill.due_day) } : null,
        };
      }),
      savings: [{ name: savings.name.trim() || 'Ahorro conjunto', kind: 'general', icon: 'piggy-bank',
        commitments: { [keyOf(0)]: parseAmount(savings.a) ?? 0, [keyOf(1)]: parseAmount(savings.b) ?? 0 } }],
    };
    create.mutate(setup, {
      onSuccess: async () => {
        toast.success('¡Hogar creado!', 'Ahora invita a tu pareja desde Configuración.');
        await queryClient.invalidateQueries({ queryKey: ['household'] });
        router.replace('/');
      },
    });
  };

  const footer = (
    <View style={{ flexDirection: 'row', gap: space[3] }}>
      {step > 0 && <Button title="Atrás" variant="outline" full={false} style={{ flex: 1 }} onPress={() => setStep(step - 1)} />}
      {step < STEPS.length - 1 ? (
        <Button testID="btn-next" title="Continuar" style={{ flex: 2 }} full={false} onPress={() => setStep(step + 1)} disabled={step === 0 && members.some((m) => !m.name.trim())} />
      ) : (
        <Button testID="btn-create-household" title="Crear hogar" icon="check" style={{ flex: 2 }} full={false} loading={create.isPending} disabled={errors.length > 0} onPress={submit} />
      )}
    </View>
  );

  return (
    <Screen header={<Header title="Configurar hogar" subtitle={`Paso ${step + 1} de ${STEPS.length} · ${STEPS[step]}`} back />} footer={footer}>
      <ProgressBar ratio={(step + 1) / STEPS.length} height={6} color={colors.accent} />
      {step === 0 && (
        <Animated.View entering={FadeInRight.duration(220)} style={{ gap: space[4] }}>
          <Input label="Nombre del hogar" value={householdName} onChangeText={setHouseholdName} icon="home" maxLength={80} />
          <Text variant="label" color="textSecondary">¿Quién eres tú?</Text>
          <Segmented options={[{ value: '0', label: members[0].name || 'Persona 1' }, { value: '1', label: members[1].name || 'Persona 2' }]} value={who} onChange={setWho} />
          {members.map((m, i) => (
            <Card key={i}>
              <View style={{ gap: space[3] }}>
                <Text variant="overline" color={i === meIdx ? 'brand' : 'textSecondary'}>{i === meIdx ? 'Tú (administrador)' : 'Tu pareja (se une con invitación)'}</Text>
                <Input label="Nombre" value={m.name} maxLength={40} onChangeText={(t) => setMembers(members.map((x, j) => (j === i ? { ...x, name: t } : x)))} />
                <Input label="Ingreso mensual (RD$)" value={m.incomeText} keyboardType="decimal-pad" onChangeText={(t) => setMembers(members.map((x, j) => (j === i ? { ...x, incomeText: t } : x)))} />
              </View>
            </Card>
          ))}
          <KeyValue label="Ingreso total del hogar"><Money value={totalIncome} variant="amountM" /></KeyValue>
        </Animated.View>
      )}
      {step === 1 && (
        <Animated.View entering={FadeInRight.duration(220)} style={{ gap: space[3] }}>
          <Banner tone="info" title="Presupuesto ≠ gasto" message="Estos montos son lo planificado. Solo los gastos que registren consumirán dinero. Todo se puede cambiar después." />
          {cats.map((c, i) => {
            const pA = Number(c.pctText) || 0;
            const upd = (patch: Partial<(typeof cats)[number]>) => setCats(cats.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <Card key={c.name}>
                <View style={{ gap: space[3] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                    <IconTile icon={c.icon} color={c.color} size={38} />
                    <Text variant="h3" style={{ flex: 1 }}>{c.name}</Text>
                    {c.kind === 'fund' && <Text variant="caption" color="fund">Fondo</Text>}
                  </View>
                  <View style={{ flexDirection: 'row', gap: space[3] }}>
                    <View style={{ flex: 3 }}><Input label="Monto (RD$)" value={c.amountText} keyboardType="decimal-pad" onChangeText={(t) => upd({ amountText: t })} /></View>
                    <View style={{ flex: 2 }}><Input label={`% ${members[1].name || 'P2'}`} value={c.pctText} keyboardType="number-pad" maxLength={3} onChangeText={(t) => upd({ pctText: t.replace(/\D/g, '') })} /></View>
                  </View>
                  <Text variant="caption" color="textSecondary">
                    {members[1].name}: {pA}% · {members[0].name}: {100 - pA}%
                  </Text>
                  {c.bill && (
                    <Input label="Día de vencimiento (1–31)" value={dueDays[c.name]} keyboardType="number-pad" maxLength={2}
                      onChangeText={(t) => setDueDays({ ...dueDays, [c.name]: t.replace(/\D/g, '') })} helper="Se usará para recordatorios de pago." />
                  )}
                </View>
              </Card>
            );
          })}
          <KeyValue label="Total presupuestado"><Money value={totalBudget} variant="amountM" /></KeyValue>
        </Animated.View>
      )}
      {step === 2 && (
        <Animated.View entering={FadeInRight.duration(220)} style={{ gap: space[4] }}>
          <Banner tone="info" title="Ahorrar no es gastar" message="Lo que aporten al ahorro conjunto se registra como ahorro, nunca como gasto." />
          <Input label="Nombre de la meta" value={savings.name} onChangeText={(t) => setSavings({ ...savings, name: t })} icon="piggy-bank" />
          <Input label={`Aporte mensual de ${members[0].name}`} value={savings.a} keyboardType="decimal-pad" onChangeText={(t) => setSavings({ ...savings, a: t })} />
          <Input label={`Aporte mensual de ${members[1].name}`} value={savings.b} keyboardType="decimal-pad" onChangeText={(t) => setSavings({ ...savings, b: t })} />
          <KeyValue label="Ahorro conjunto mensual"><Money value={savingsTotal} color="savings" /></KeyValue>
        </Animated.View>
      )}
      {step === 3 && (
        <Animated.View entering={FadeInRight.duration(220)} style={{ gap: space[3] }}>
          {errors.map((e) => <Banner key={e} tone="danger" title={e} />)}
          {create.error && <Banner tone="danger" title="No pudimos crear el hogar" message={errorMessage(create.error)} />}
          <Card>
            <View style={{ gap: space[1] }}>
              <KeyValue label="Ingresos" value={formatMoney(totalIncome)} />
              <KeyValue label="Presupuesto" value={formatMoney(totalBudget)} />
              <KeyValue label="Ahorro conjunto" value={formatMoney(savingsTotal)} />
              <Divider />
              <KeyValue label="Margen después de todo"><Money value={totalIncome - totalBudget - savingsTotal} color={totalIncome - totalBudget - savingsTotal >= 0 ? 'positive' : 'negative'} /></KeyValue>
            </View>
          </Card>
          <Text variant="caption" color="textSecondary">
            Se crearán los fondos Caja chica, Fondo de salidas, Fondo común y Fondo de emergencia (con saldo RD$0; nunca se inventa saldo), los servicios con recordatorios y la meta de ahorro.
          </Text>
        </Animated.View>
      )}
    </Screen>
  );
}
