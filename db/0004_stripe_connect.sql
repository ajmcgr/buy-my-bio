-- SOCIAL BID — Stripe Connect payouts (escrow-style hold, then transfer)
-- Run after 0003_marketplace_integrity.sql in the Supabase SQL editor.

alter table public.creators
  add column if not exists stripe_account_id text unique,
  add column if not exists stripe_payouts_enabled boolean not null default false,
  add column if not exists stripe_details_submitted boolean not null default false,
  add column if not exists stripe_onboarded_at timestamptz;

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  payment_id uuid not null unique references public.payments (id) on delete cascade,
  ownership_id uuid references public.ownerships (id) on delete set null,
  gross_cents integer not null check (gross_cents >= 0),
  fee_cents integer not null check (fee_cents >= 0),
  amount_cents integer not null check (amount_cents >= 0),
  fee_percentage numeric(6, 2) not null default 20.00,
  status text not null default 'pending'
    check (status in ('pending', 'blocked', 'paid', 'failed', 'cancelled')),
  hold_until timestamptz not null,
  released_at timestamptz,
  stripe_transfer_id text unique,
  last_error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists payouts_due_idx on public.payouts (status, hold_until);
create index if not exists payouts_creator_idx on public.payouts (creator_id, created_at desc);

grant all on public.payouts to service_role;
alter table public.payouts enable row level security;
-- No anon/authenticated grants: payouts are read and written by the server only.

comment on table public.payouts is
  'One row per applied, live-mode payment. Funds are held on the platform until hold_until passes and the creator X bio placement re-verifies, then transferred to the creator Stripe Connect account.';
