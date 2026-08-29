-- BUY MY BIO — continuous placement verification (7-day payout hold)
-- Safe to re-run. Preserves all existing data.

-- Buyer's sponsored URL is stored on payments/ownerships as destination_url
-- already; these columns record the verification history of the placement.

alter table public.ownerships
  add column if not exists last_bio_verified_at timestamptz,
  add column if not exists bio_verification_status text not null default 'pending',
  add column if not exists verification_failure_at timestamptz,
  add column if not exists verification_failure_reason text,
  add column if not exists last_verification_attempt_at timestamptz,
  add column if not exists last_verification_error text;

alter table public.payouts
  add column if not exists last_bio_verified_at timestamptz,
  add column if not exists bio_verification_status text not null default 'pending',
  add column if not exists verification_failure_at timestamptz,
  add column if not exists verification_failure_reason text,
  add column if not exists last_verification_attempt_at timestamptz,
  add column if not exists last_verification_error text;

alter table public.listings
  add column if not exists compliance_status text not null default 'compliant',
  add column if not exists non_compliant_since timestamptz,
  add column if not exists non_compliant_reason text;

-- Trust/reputation record of confirmed placement violations.
create table if not exists public.placement_violations (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  ownership_id uuid references public.ownerships (id) on delete set null,
  payout_id uuid references public.payouts (id) on delete set null,
  phase text not null, -- 'hold' | 'post_payout'
  reason text not null,
  bio_snapshot text,
  created_at timestamptz not null default now()
);

create index if not exists placement_violations_creator_idx
  on public.placement_violations (creator_id, created_at desc);

grant all on public.placement_violations to service_role;
alter table public.placement_violations enable row level security;

comment on table public.placement_violations is
  'Confirmed cases where a creator removed or changed the current owner placement. Used for payout blocking and future seller trust scoring.';
