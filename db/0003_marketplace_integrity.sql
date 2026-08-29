-- Public Bio Value provenance.
-- A rankable ownership must come from an applied, non-refunded, live-mode Stripe payment.

alter table public.payments
  add column if not exists stripe_livemode boolean not null default false,
  add column if not exists paid_at timestamptz;

create index if not exists payments_public_value_idx
  on public.payments (status, stripe_livemode, refund_status, paid_at desc);

comment on column public.payments.stripe_livemode is
  'Copied from the verified Stripe Checkout Session. Only true rows may create public Bio Value.';

comment on column public.payments.paid_at is
  'Timestamp at which Stripe verified the Checkout Session as paid.';

-- The existing admin uses "paused" as a reversible listing state.
alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status in ('draft', 'pending', 'active', 'paused', 'suspended', 'rejected'));
