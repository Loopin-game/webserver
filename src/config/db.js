import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl =
    process.env.SUPABASE_URL || 'https://whssxsnrukuarrhcufsu.supabase.co';
const supabaseKey =
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
    console.error(
        '[db] Missing Supabase key. Set SUPABASE_KEY (service role) or SUPABASE_SERVICE_ROLE_KEY in your environment.'
    );
}

/**
 * Whether the server can talk to Supabase (key present and non-empty).
 */
export function isDatabaseConfigured() {
    return Boolean(supabaseKey && supabaseKey.length > 10);
}

export const supabase = createClient(supabaseUrl, supabaseKey || 'invalid-placeholder-key');
