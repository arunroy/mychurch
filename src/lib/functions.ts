import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from './supabase';

/**
 * Calls an edge function and returns what it answered. When it fails, throws an error whose message
 * is the function's own explanation; the platform (missing function, bad token) answers with
 * `message` instead, so keep the status to make a failure traceable.
 */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (!error) return data as T;

  if (error instanceof FunctionsHttpError) {
    const status = error.context.status;
    const detail = await error.context.json().catch(() => null);
    if (detail?.error) throw new Error(detail.error);
    throw new Error(`Could not complete that (${status}${detail?.message ? `: ${detail.message}` : ''}).`);
  }
  throw new Error(`Could not reach the server (${error.message}).`);
}
