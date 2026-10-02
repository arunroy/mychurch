import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useUserId } from './auth';
import type { Church, MemberRole, Membership } from './database.types';
import { supabase } from './supabase';

export type MyMembership = Membership & { church: Church };

/**
 * - none: not part of any church yet, so show the join / register choice
 * - waiting: the active church hasn't approved this person, or hasn't been verified itself
 * - ready: an approved member of a verified church
 */
export type ChurchState = 'loading' | 'none' | 'waiting' | 'ready';

type ChurchContextValue = {
  state: ChurchState;
  memberships: MyMembership[];
  active: MyMembership | null;
  setActiveChurch: (churchId: string) => Promise<void>;
  refresh: () => Promise<MyMembership[]>;
};

const ACTIVE_KEY = 'mychurch.activeChurchId';

const ChurchContext = createContext<ChurchContextValue | null>(null);

export function isReady(m: MyMembership) {
  return m.status === 'approved' && m.church.status === 'active';
}

export function stateFor(m: MyMembership | null | undefined): ChurchState {
  if (!m) return 'none';
  return isReady(m) ? 'ready' : 'waiting';
}

// The saved church if the person still belongs to it, otherwise the first one they can use.
export function pickActive(memberships: MyMembership[], preferredId: string | null) {
  return (
    memberships.find((m) => m.church_id === preferredId) ?? memberships.find(isReady) ?? memberships[0] ?? null
  );
}

async function fetchMemberships(userId: string): Promise<MyMembership[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select('*, church:churches(*)')
    .eq('user_id', userId)
    .order('created_at');
  if (error) throw error;
  return data;
}

export function ChurchProvider({ children }: { children: ReactNode }) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const [preferredId, setPreferredId] = useState<string | null>(null);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ACTIVE_KEY)
      .then(setPreferredId)
      .finally(() => setPreferenceLoaded(true));
  }, []);

  const query = useQuery({
    queryKey: ['memberships', userId],
    enabled: !!userId,
    queryFn: () => fetchMemberships(userId!),
  });

  const memberships = useMemo(() => query.data ?? [], [query.data]);
  const active = pickActive(memberships, preferredId);
  const state: ChurchState = !preferenceLoaded || query.isPending ? 'loading' : stateFor(active);

  const setActiveChurch = useCallback(async (churchId: string) => {
    setPreferredId(churchId);
    await AsyncStorage.setItem(ACTIVE_KEY, churchId);
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return [];
    return queryClient.fetchQuery({ queryKey: ['memberships', userId], queryFn: () => fetchMemberships(userId) });
  }, [queryClient, userId]);

  return (
    <ChurchContext.Provider value={{ state, memberships, active, setActiveChurch, refresh }}>
      {children}
    </ChurchContext.Provider>
  );
}

export function useChurch() {
  const value = useContext(ChurchContext);
  if (!value) throw new Error('useChurch must be used inside ChurchProvider');
  return value;
}

/** The active church, for screens that only render once the person is an approved member. */
export function useActiveChurch() {
  const { active } = useChurch();
  if (!active) throw new Error('No active church');
  return active;
}

const LEADERS: MemberRole[] = ['pastor', 'elder', 'admin'];

export function usePermissions() {
  const { active } = useChurch();
  const role = active?.status === 'approved' ? active.role : null;
  return {
    role,
    isPastor: role === 'pastor',
    isLeader: !!role && LEADERS.includes(role),
    canEditChurch: role === 'pastor' || role === 'admin',
    // The church's money: the Pastor and elders only, not church admins.
    canSeeFunds: role === 'pastor' || role === 'elder',
    // Creates and manages the chat groups for committees and fellowships.
    canManageChatGroups: role === 'pastor' || role === 'elder',
    canChangeRoles: role === 'pastor',
  };
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  pastor: 'Pastor',
  elder: 'Elder',
  admin: 'Church admin',
  member: 'Member',
};
