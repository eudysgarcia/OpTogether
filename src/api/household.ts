import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';
import type { Household, IncomeRecord, Member } from '../types/models';

export type HouseholdData = {
  household: Household | null;
  members: Member[];
  me: Member | null;
  partner: Member | null;
  memberName: (id: string | null | undefined) => string;
};

/** Hogar del usuario actual. null => debe hacer onboarding. */
export function useHousehold() {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: ['household', uid],
    enabled: !!uid,
    queryFn: async (): Promise<HouseholdData> => {
      const members = unwrap(await supabase.from('household_members').select('*').order('created_at')) ?? [];
      const me = members.find((m) => m.user_id === uid) ?? null;
      if (!me) return { household: null, members: [], me: null, partner: null, memberName: () => '' };
      const household = unwrap(await supabase.from('households').select('*').eq('id', me.household_id).single());
      const partner = members.find((m) => m.id !== me.id) ?? null;
      const names = new Map(members.map((m) => [m.id, m.display_name]));
      return { household, members, me, partner, memberName: (id) => (id ? names.get(id) ?? '—' : 'Hogar') };
    },
  });
}

/** Acceso conveniente cuando el hogar ya está garantizado (pantallas dentro de la app). */
export function useHH() {
  const q = useHousehold();
  const d = q.data;
  return {
    ...q,
    hid: d?.household?.id ?? '',
    household: d?.household ?? null,
    members: d?.members ?? [],
    me: d?.me ?? null,
    partner: d?.partner ?? null,
    memberName: d?.memberName ?? (() => ''),
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
      unwrap(await supabase.from('income_records').select('*').eq('household_id', hid).order('effective_from', { ascending: false })) as IncomeRecord[],
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
      unwrap(await supabase.rpc('create_household', { p_setup: setup as never })),
  });
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: async (v: { code: string; name?: string }) =>
      unwrap(await supabase.rpc('accept_invite', { p_code: v.code, p_display_name: v.name })),
  });
}
