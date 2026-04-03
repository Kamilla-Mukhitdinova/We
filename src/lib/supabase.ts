import { createClient } from '@supabase/supabase-js';
import { Owner } from './types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const storageMode = import.meta.env.VITE_STORAGE_MODE || 'auto';
const kamillaEmail = import.meta.env.VITE_KAMILLA_EMAIL;
const doszhanEmail = import.meta.env.VITE_DOSZHAN_EMAIL;
const isTestMode = import.meta.env.MODE === 'test';
const isLocalOnlyMode = storageMode === 'local';

export const ownerEmailMap: Record<Owner, string | undefined> = {
  Kamilla: kamillaEmail,
  Doszhan: doszhanEmail,
};

export function getOwnerByEmail(email?: string | null): Owner | null {
  if (!email) return null;
  if (kamillaEmail && email.toLowerCase() === kamillaEmail.toLowerCase()) return 'Kamilla';
  if (doszhanEmail && email.toLowerCase() === doszhanEmail.toLowerCase()) return 'Doszhan';
  return null;
}

export const isSupabaseConfigured =
  !isTestMode &&
  !isLocalOnlyMode &&
  Boolean(url && anonKey && kamillaEmail && doszhanEmail);
export const SUPABASE_STATE_ROW_ID = import.meta.env.VITE_SUPABASE_APP_STATE_ID || 'we-planner-main';

export const supabase = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
