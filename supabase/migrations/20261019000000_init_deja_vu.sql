-- Déjà Vu — initial schema
-- Sessions = one debugging session (captured by voice), embedded for semantic recall.

create extension if not exists vector with schema extensions;

create table if not exists public.sessions (
  id                       uuid primary key default gen_random_uuid(),
  raw_transcript_redacted  text not null,               -- redacted BEFORE insert (edge function)
  symptom                  text not null,
  hypotheses_tried         jsonb not null default '[]',  -- [{ "text": "...", "ruled_out": true|false|null }]
  root_cause               text not null default '',
  fix                      text not null default '',
  tags                     text[] not null default '{}',
  status                   text not null default 'resolved' check (status in ('resolved', 'open')),
  sample                   boolean not null default false, -- true = demo/sample incident, not a real one
  created_at               timestamptz not null default now(),
  updated_at               timestamptz,
  embedding                extensions.vector(384)        -- gte-small (Supabase.ai) or OpenAI text-embedding-3-small @ 384 dims
);

create index if not exists sessions_created_at_idx on public.sessions (created_at desc);
create index if not exists sessions_tags_idx on public.sessions using gin (tags);
-- HNSW works well from 0 rows upward (ivfflat needs data to train lists).
create index if not exists sessions_embedding_hnsw_idx
  on public.sessions using hnsw (embedding extensions.vector_cosine_ops);

-- Recall RPC: cosine similarity (1 - cosine distance) above a hard threshold.
create or replace function public.match_sessions(
  query_embedding extensions.vector(384),
  match_threshold float default 0.8,
  match_count int default 5
)
returns table (
  id uuid,
  raw_transcript_redacted text,
  symptom text,
  hypotheses_tried jsonb,
  root_cause text,
  fix text,
  tags text[],
  status text,
  sample boolean,
  created_at timestamptz,
  similarity float
)
language sql stable
set search_path = public, extensions
as $$
  select s.id, s.raw_transcript_redacted, s.symptom, s.hypotheses_tried, s.root_cause, s.fix,
         s.tags, s.status, s.sample, s.created_at,
         1 - (s.embedding <=> query_embedding) as similarity
  from public.sessions s
  where s.embedding is not null
    and 1 - (s.embedding <=> query_embedding) >= match_threshold
  order by s.embedding <=> query_embedding
  limit least(match_count, 20);
$$;

-- ── Row Level Security ────────────────────────────────────────────────
-- Déjà Vu is a SINGLE-USER personal tool. For the hackathon demo, the anon key may read,
-- update and delete rows so the static frontend works without sign-in.
-- Inserts and re-embeds go through the edge functions (service role), which redact first.
-- ⚠️ Anyone with your anon key + project URL can read your sessions. For real use, enable
-- Supabase Auth and replace these policies with `using (auth.uid() = user_id)`.
alter table public.sessions enable row level security;

drop policy if exists "demo anon read" on public.sessions;
drop policy if exists "demo anon update status" on public.sessions;
drop policy if exists "demo anon delete" on public.sessions;

create policy "demo anon read"   on public.sessions for select to anon, authenticated using (true);
create policy "demo anon update status" on public.sessions for update to anon, authenticated using (true) with check (true);
create policy "demo anon delete" on public.sessions for delete to anon, authenticated using (true);

grant execute on function public.match_sessions(extensions.vector, float, int) to anon, authenticated, service_role;
