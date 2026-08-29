-- SOCIAL BID — X (Twitter) creator verification
-- Run after the initial schema migration in the Supabase SQL editor.

alter table public.creators
  add column if not exists x_user_id text unique,
  add column if not exists x_username text,
  add column if not exists x_display_name text,
  add column if not exists x_profile_image_url text,
  add column if not exists x_profile_url text,
  add column if not exists x_follower_count integer,
  add column if not exists x_account_verified boolean not null default false,
  add column if not exists x_account_verified_at timestamptz,
  add column if not exists x_bio_verified boolean not null default false,
  add column if not exists x_bio_verified_at timestamptz,
  add column if not exists x_bio_verified_method text
    check (x_bio_verified_method in ('api', 'admin')),
  add column if not exists x_bio_snapshot text,
  add column if not exists session_token text unique;

create index if not exists creators_session_token_idx on public.creators (session_token);

-- ---------------------------------------------------------------- oauth state
create table if not exists public.x_oauth_states (
  state text primary key,
  code_verifier text not null,
  created_at timestamptz not null default now()
);

grant all on public.x_oauth_states to service_role;
alter table public.x_oauth_states enable row level security;
-- No anon/authenticated grants: service role only.
