-- SOCIAL BID — repair the activation verification columns required by
-- src/lib/activation.server.ts. This captures the production-only manual
-- schema repair so fresh environments and migration audits stay consistent.
--
-- Additive and idempotent: no rows are updated and no Post payment path,
-- Stripe configuration, or Vault secret is modified.

alter table public.ownerships
  add column if not exists bio_verification_status text not null default 'pending',
  add column if not exists last_bio_verified_at timestamptz,
  add column if not exists verification_failure_at timestamptz,
  add column if not exists verification_failure_reason text,
  add column if not exists last_verification_attempt_at timestamptz,
  add column if not exists last_verification_error text;

alter table public.payouts
  add column if not exists bio_verification_status text not null default 'pending',
  add column if not exists last_bio_verified_at timestamptz,
  add column if not exists verification_failure_at timestamptz,
  add column if not exists verification_failure_reason text,
  add column if not exists last_verification_attempt_at timestamptz,
  add column if not exists last_verification_error text;

create index if not exists ownerships_activation_idx
  on public.ownerships (placement_status, activation_deadline);

create index if not exists payouts_release_idx
  on public.payouts (status, release_at);
