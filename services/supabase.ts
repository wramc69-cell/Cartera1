import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

console.log(`[SUPABASE] Cliente iniciando en: ${supabaseUrl ? new URL(supabaseUrl).hostname : 'URL_MISSING'}`);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'CRITICAL: Supabase URL or Anon Key is missing. ' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your settings.'
  );
}

// We export the singleton client instance
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Base Database Error class for consistent error handling
 */
export class DatabaseError extends Error {
  constructor(
    public message: string,
    public operation: string,
    public originalError?: any,
    public code?: string,
    public status?: number
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}
