import React from 'react';
import { View } from 'react-native';
import { useHH } from '../../api/household';
import { formatMoney } from '../../lib/money';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';
import type { AuditLog } from '../../types/models';
import { Icon, Text } from '../ui';

const FIELD_LABEL: Record<string, string> = {
  amount: 'Monto', description: 'Descripción', occurred_on: 'Fecha', notes: 'Observaciones', category_id: 'Categoría', status: 'Estado',
  fund_id: 'Fondo origen', to_fund_id: 'Fondo destino', member_id: 'Miembro', is_extraordinary: 'Extraordinario', payment_method_id: 'Método de pago',
  name: 'Nombre', estimated_amount: 'Monto estimado', due_date: 'Vencimiento', due_day: 'Día de vencimiento', original_amount: 'Monto original',
  interest_rate: 'Interés', target_amount: 'Objetivo', initial_balance: 'Saldo inicial', shares: 'Distribución', archived_at: 'Archivado', cancelled_at: 'Cancelado',
  display_name: 'Nombre', role: 'Rol', deleted_at: 'Eliminado', voided_at: 'Revertido',
};

export const TABLE_LABEL: Record<string, string> = {
  transactions: 'Movimiento', budget_allocations: 'Presupuesto', budget_moves: 'Ajuste de presupuesto', funds: 'Fondo', savings_goals: 'Meta de ahorro',
  debts: 'Deuda', bills: 'Servicio', bill_cycles: 'Ciclo de pago', categories: 'Categoría', household_members: 'Miembro', income_records: 'Ingreso',
  transaction_attachments: 'Comprobante', reminders: 'Recordatorio', households: 'Hogar', payment_methods: 'Método de pago',
};

export function AuditEntry({ l, showTable }: { l: AuditLog; showTable?: boolean }) {
  const { colors } = useTheme();
  const { uid } = useHH();
  const changes: string[] = [];
  if (l.action === 'update' && l.old_data && l.new_data) {
    const o = l.old_data as Record<string, unknown>;
    const n = l.new_data as Record<string, unknown>;
    for (const k of Object.keys(FIELD_LABEL)) {
      if (JSON.stringify(o[k]) !== JSON.stringify(n[k])) {
        const fmt = (v: unknown) => (['amount', 'estimated_amount', 'original_amount', 'target_amount', 'initial_balance'].includes(k) ? formatMoney(v as number) : v === null || v === undefined ? '—' : typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v).length > 30 ? `${String(v).slice(0, 30)}…` : String(v));
        changes.push(`${FIELD_LABEL[k]}: ${fmt(o[k])} → ${fmt(n[k])}`);
      }
    }
  }
  const label = { insert: 'Creado', update: 'Editado', void: 'Anulado', delete: 'Eliminado' }[l.action] ?? l.action;
  const icon = { insert: 'plus', update: 'edit', void: 'ban', delete: 'trash' }[l.action] ?? 'history';
  const n = (l.new_data ?? l.old_data) as Record<string, unknown> | null;
  const what = typeof n?.description === 'string' ? n.description : typeof n?.name === 'string' ? n.name : null;
  return (
    <View style={{ flexDirection: 'row', gap: space[3], paddingVertical: space[2] }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={14} color={colors.textSecondary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{showTable ? `${TABLE_LABEL[l.table_name] ?? l.table_name} ${label.toLowerCase()}` : label} · {l.actor === uid ? 'por ti' : l.actor ? 'por tu pareja' : 'por el sistema'}</Text>
        {showTable && what && <Text variant="caption">{what}</Text>}
        <Text variant="caption" color="textSecondary">{new Date(l.created_at).toLocaleString('es-DO')}</Text>
        {changes.map((c) => <Text key={c} variant="caption">{c}</Text>)}
        {l.reason && <Text variant="caption" color="textSecondary">Motivo: {l.reason}</Text>}
      </View>
    </View>
  );
}
