/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_APP_STATE_ID?: string;
  readonly VITE_KAMILLA_EMAIL?: string;
  readonly VITE_DOSZHAN_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
