import { createClient } from '@supabase/supabase-js';
import { Owner } from './types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const storageMode = import.meta.env.VITE_STORAGE_MODE || 'local';
const kamillaEmail = import.meta.env.VITE_KAMILLA_EMAIL;
const isTestMode = import.meta.env.MODE === 'test';
const isLocalOnlyMode = storageMode === 'local';
const isSharedMode = storageMode === 'shared' || storageMode === 'auto';

export const ownerEmailMap: Record<Owner, string | undefined> = {
  Kamilla: kamillaEmail,
  Doszhan: undefined,
};

export function getOwnerByEmail(email?: string | null): Owner | null {
  if (!email) return null;
  if (kamillaEmail && email.toLowerCase() === kamillaEmail.toLowerCase()) return 'Kamilla';
  return null;
}

export const isSupabaseConfigured =
  !isTestMode &&
  !isLocalOnlyMode &&
  isSharedMode &&
  Boolean(url && anonKey && kamillaEmail);
export const SUPABASE_STATE_ROW_ID = import.meta.env.VITE_SUPABASE_APP_STATE_ID || 'we-planner-main';

export const supabase = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
