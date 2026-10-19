import { createClient } from 'jsr:@supabase/supabase-js@2';

// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically into every edge function.
export const admin = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

export const SESSION_COLS =
  'id,raw_transcript_redacted,symptom,hypotheses_tried,root_cause,fix,tags,status,sample,created_at,updated_at';
