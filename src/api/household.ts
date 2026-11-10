import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { db, unwrap } from '../lib/api';
import { useAuth } from '../providers/AuthProvider';
import type { Household, IncomeRecord, Member } from '../types/models';

/** Solo datos serializables: la caché se persiste en disco (las funciones no sobreviven). */
export type HouseholdData = {
  household: Household | null;
  members: Member[];
  me: Member | null;
  partner: Member | null;
};

/** Hogar del usuario actual. null => debe hacer onboarding. */
export function useHousehold() {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: ['household', uid],
    enabled: !!uid,
    queryFn: async (): Promise<HouseholdData> => {
      const members = unwrap(await db.from('household_members').select('*').order('created_at')) ?? [];
      const me = members.find((m) => m.user_id === uid) ?? null;
      if (!me) return { household: null, members: [], me: null, partner: null };
      const household = unwrap(await db.from('households').select('*').eq('id', me.household_id).single());
      const partner = members.find((m) => m.id !== me.id) ?? null;
      return { household, members, me, partner };
    },
  });
}

/** Acceso conveniente cuando el hogar ya está garantizado (pantallas dentro de la app). */
export function useHH() {
  const q = useHousehold();
  const d = q.data;
  const memberName = useMemo(() => {
    const names = new Map((d?.members ?? []).map((m) => [m.id, m.display_name]));
    return (id: string | null | undefined) => (id ? names.get(id) ?? '—' : 'Hogar');
  }, [d?.members]);
  return {
    ...q,
    hid: d?.household?.id ?? '',
    household: d?.household ?? null,
    members: d?.members ?? [],
    me: d?.me ?? null,
    partner: d?.partner ?? null,
    memberName,
    isAdmin: d?.me?.role === 'admin',
    uid: d?.me?.user_id ?? '',
  };
}

export function useIncomes() {
  const { hid } = useHH();
  return useQuery({
    queryKey: ['incomes', hid],
    enabled: !!hid,
    queryFn: async () =>
      unwrap(await db.from('income_records').select('*').eq('household_id', hid).order('effective_from', { ascending: false })) as IncomeRecord[],
  });
}

/** Ingreso vigente por miembro (el registro más reciente con fecha efectiva <= hoy). */
export function currentIncomes(records: IncomeRecord[] | undefined, today: string) {
  const out: Record<string, number> = {};
  for (const r of [...(records ?? [])].sort((a, b) => a.effective_from.localeCompare(b.effective_from))) {
    if (r.effective_from <= today) out[r.member_id] = Number(r.amount);
  }
  return out;
}

export function useCreateHousehold() {
  return useMutation({
    mutationFn: async (setup: Record<string, unknown>) =>
      unwrap(await db.rpc('create_household', { p_setup: setup as never })),
  });
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: async (v: { code: string; name?: string }) =>
      unwrap(await db.rpc('accept_invite', { p_code: v.code, p_display_name: v.name })),
  });
}
