-- Automatic buyer refunds + lightweight per-purchase audit trail.
-- Additive only: no existing column, row or function is dropped.

-- ------------------------------------------------------------------ payments
alter table public.payments add column if not exists stripe_refund_id text;
alter table public.payments add column if not exists refunded_at timestamptz;
alter table public.payments add column if not exists refund_reason text;
alter table public.payments add column if not exists refund_error text;
alter table public.payments add column if not exists refund_attempts integer not null default 0;
alter table public.payments add column if not exists refund_last_attempt_at timestamptz;
alter table public.payments add column if not exists admin_review_required boolean not null default false;
alter table public.payments add column if not exists admin_review_reason text;

-- widen the refund lifecycle: none -> requested/pending -> refunded | failed
alter table public.payments drop constraint if exists payments_refund_status_check;
alter table public.payments
  add constraint payments_refund_status_check
  check (refund_status in ('none','requested','pending','refunded','failed','declined'));

create unique index if not exists payments_stripe_refund_id_key
  on public.payments (stripe_refund_id) where stripe_refund_id is not null;

create index if not exists payments_refund_queue_idx
  on public.payments (needs_refund, refund_status)
  where needs_refund = true;

create index if not exists payments_admin_review_idx
  on public.payments (admin_review_required) where admin_review_required = true;

-- ------------------------------------------------------- transaction events
create table if not exists public.transaction_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  ownership_id uuid references public.ownerships(id) on delete set null,
  payout_id uuid references public.payouts(id) on delete set null,
  event text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant all on public.transaction_events to service_role;

alter table public.transaction_events enable row level security;

create index if not exists transaction_events_payment_idx
  on public.transaction_events (payment_id, created_at desc);
create index if not exists transaction_events_created_idx
  on public.transaction_events (created_at desc);
