import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { FundsSummary, FundTransactionWithPeople } from './database.types';
import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Money helpers. Amounts are kept to the penny, so sums are done in whole pennies.
// ---------------------------------------------------------------------------

/** The currencies a church can choose. The symbol is what people expect to see next to the code. */
export const CURRENCIES = [
  { code: 'INR', symbol: '₹' },
  { code: 'GBP', symbol: '£' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CAD', symbol: 'C$' },
  { code: 'NZD', symbol: 'NZ$' },
  { code: 'SGD', symbol: 'S$' },
  { code: 'AED', symbol: 'AED' },
] as const;

// Numbers are grouped the way each currency's country writes them: 12,34,567 for rupees, 1,234,567 elsewhere.
const LOCALE_FOR: Record<string, string> = {
  INR: 'en-IN',
  GBP: 'en-GB',
  USD: 'en-US',
  EUR: 'en-IE',
  AUD: 'en-AU',
  CAD: 'en-CA',
  NZD: 'en-NZ',
  SGD: 'en-SG',
  AED: 'en-AE',
};

export function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(LOCALE_FOR[currency] ?? 'en', { style: 'currency', currency }).format(amount);
  } catch {
    // A phone whose text engine lacks the currency still shows a clear amount.
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export const toCents = (amount: number) => Math.round(amount * 100);
export const fromCents = (cents: number) => cents / 100;

// People type digits in their own script on Indian-language keyboards. Read them as ordinary digits.
const DIGIT_BLOCKS = [0x0966, 0x0be6, 0x0d66, 0x0ce6]; // Devanagari, Tamil, Malayalam, Kannada zero

function asciiDigits(text: string) {
  return text.replace(/[०-९௦-௯൦-൯೦-೯]/g, (ch) => {
    const code = ch.charCodeAt(0);
    const zero = DIGIT_BLOCKS.find((block) => code >= block && code <= block + 9)!;
    return String(code - zero);
  });
}

/**
 * Reads an amount as typed: "2500", "2,500.50", "₹ 1,25,000", "१२५००". Returns the amount in pounds, rupees or
 * whatever the currency is, rounded to the penny, or null if it is not a sensible positive amount. A comma is
 * only ever a thousands separator and a full stop is the decimal point.
 */
export function parseAmount(text: string): number | null {
  // A currency sign or "Rs" in front is fine; any other letter or a minus sign is not an amount.
  const cleaned = asciiDigits(text)
    .trim()
    .replace(/^(rs\.?|inr|gbp|usd|eur|[₹£$€])\s*/i, '')
    .replace(/\s+/g, '');
  if (!/^[\d.,]+$/.test(cleaned)) return null;
  if (!/^\d{1,3}(,\d{2,3})*(\.\d{0,2})?$|^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned.replace(/,/g, ''));
  if (!Number.isFinite(value) || value <= 0 || value >= 1e12) return null;
  return fromCents(toCents(value));
}

/** Money in is positive and money out is negative. */
export const signedAmount = (kind: 'in' | 'out', amount: number) => (kind === 'in' ? amount : -amount);

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

// Each transaction points at profiles twice, for who added it and who last changed it, so the foreign key
// is named to tell the database which one is meant.
const TRANSACTION_SELECT =
  '*, adder:profiles!fund_transactions_created_by_fkey(full_name), editor:profiles!fund_transactions_updated_by_fkey(full_name)';

/** The balance and settings. Null until the funds have been set up. Only the Pastor and elders can ask. */
export function useFundsSummary(churchId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['funds', churchId, 'summary'],
    enabled,
    retry: false,
    queryFn: async (): Promise<FundsSummary | null> => {
      const { data, error } = await supabase.rpc('church_funds_summary', { p_church: churchId });
      if (error) throw error;
      return data[0] ?? null;
    },
  });
}

/** The newest transactions first. */
export function useTransactions(churchId: string, limit: number, enabled: boolean) {
  return useQuery({
    queryKey: ['funds', churchId, 'transactions', limit],
    enabled,
    retry: false,
    queryFn: async (): Promise<FundTransactionWithPeople[]> => {
      const { data, error } = await supabase
        .from('fund_transactions')
        .select(TRANSACTION_SELECT)
        .eq('church_id', churchId)
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}

function useRefreshFunds(churchId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['funds', churchId] });
}

export type FundsSettings = { currency: string; opening_balance: number; opening_date: string; account_label: string };

/** Sets the funds up the first time, or changes the settings. */
export function useSaveFunds(churchId: string) {
  const refresh = useRefreshFunds(churchId);
  return useMutation({
    mutationFn: async ({ settings, exists }: { settings: FundsSettings; exists: boolean }) => {
      const { error } = exists
        ? await supabase.from('church_funds').update(settings).eq('church_id', churchId)
        : await supabase.from('church_funds').insert({ church_id: churchId, ...settings });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export type TransactionInput = {
  occurred_on: string;
  description: string;
  note: string;
  amount: number;
  /** Who the money came from or went to; empty when not said. Linked to a member when one was picked. */
  party_name: string;
  party_user_id: string | null;
};

/**
 * Names already used on entries for people who are not members, newest first, so the same name does not
 * have to be typed again. Members are picked from the member list instead.
 */
export function usePartyNames(churchId: string) {
  return useQuery({
    queryKey: ['funds', churchId, 'party-names'],
    retry: false,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('fund_transactions')
        .select('party_name')
        .eq('church_id', churchId)
        .is('party_user_id', null)
        .neq('party_name', '')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return [...new Set(data.map((row) => row.party_name))];
    },
  });
}

export function useAddTransaction(churchId: string, userId: string) {
  const refresh = useRefreshFunds(churchId);
  return useMutation({
    mutationFn: async (input: TransactionInput) => {
      const { error } = await supabase.from('fund_transactions').insert({ church_id: churchId, created_by: userId, ...input });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useUpdateTransaction(churchId: string) {
  const refresh = useRefreshFunds(churchId);
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: TransactionInput }) => {
      const { error } = await supabase.from('fund_transactions').update(input).eq('id', id).eq('church_id', churchId);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useDeleteTransaction(churchId: string) {
  const refresh = useRefreshFunds(churchId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fund_transactions').delete().eq('id', id).eq('church_id', churchId);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}
