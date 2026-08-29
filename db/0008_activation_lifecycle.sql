-- BUY MY BIO — purchase / activation / payout state separation.
-- Additive + backfill only. Safe to re-run. No data is deleted.

-- ---------------------------------------------------------------- ownerships
alter table public.ownerships
  add column if not exists placement_status text not null default 'awaiting_activation',
  add column if not exists activation_deadline timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists first_verified_at timestamptz;

comment on column public.ownerships.placement_status is
  'awaiting_activation | active | outbid | activation_failed | superseded_before_activation | non_compliant';

-- Backfill legacy rows: anything that already existed was treated as live.
update public.ownerships
  set first_verified_at = coalesce(first_verified_at, started_at),
      activated_at = coalesce(activated_at, started_at),
      activation_deadline = coalesce(activation_deadline, started_at + interval '24 hours')
  where first_verified_at is null;

update public.ownerships
  set placement_status = case
        when status = 'active' then 'active'
        else 'outbid'
      end
  where placement_status = 'awaiting_activation';

-- These refinements depend on optional columns introduced by 0006/0007.
-- Dynamic SQL prevents PostgreSQL from resolving columns that are absent.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ownerships'
      and column_name = 'last_bio_verified_at'
  ) then
    execute $sql$
      update public.ownerships
      set first_verified_at = coalesce(last_bio_verified_at, first_verified_at),
          activated_at = coalesce(last_bio_verified_at, activated_at)
      where last_bio_verified_at is not null
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ownerships'
      and column_name = 'bio_verification_status'
  ) then
    execute $sql$
      update public.ownerships
      set placement_status = 'non_compliant'
      where status = 'active' and bio_verification_status = 'failed'
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ownerships'
      and column_name = 'placement_end_reason'
  ) then
    execute $sql$
      update public.ownerships
      set placement_status = 'non_compliant'
      where placement_end_reason = 'seller_removed'
    $sql$;
  end if;
end $$;

-- ---------------------------------------------------------------- payouts
alter table public.payouts
  add column if not exists first_verified_at timestamptz,
  add column if not exists release_at timestamptz,
  add column if not exists payout_status text not null default 'not_eligible';

comment on column public.payouts.release_at is
  'first_verified_at + PAYOUT_HOLD_DAYS. NULL until the placement has been verified live at least once.';
comment on column public.payouts.payout_status is
  'not_eligible | pending | released | blocked';

-- Backfill existing payouts from the old hold_until behaviour.
update public.payouts p
  set first_verified_at = coalesce(p.first_verified_at, o.first_verified_at),
      release_at = coalesce(p.release_at, p.hold_until)
  from public.ownerships o
  where o.payment_id = p.payment_id
    and (p.release_at is null or p.first_verified_at is null);

update public.payouts
  set release_at = coalesce(release_at, hold_until),
      first_verified_at = coalesce(first_verified_at, created_at)
  where release_at is null;

-- Preserve the more accurate legacy verification timestamp when 0006 exists.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payouts'
      and column_name = 'last_bio_verified_at'
  ) then
    execute $sql$
      update public.payouts
      set first_verified_at = coalesce(last_bio_verified_at, first_verified_at)
      where last_bio_verified_at is not null
    $sql$;
  end if;
end $$;

update public.payouts
  set payout_status = case
        when status = 'paid' then 'released'
        when status in ('blocked', 'cancelled', 'failed') then 'blocked'
        when first_verified_at is null then 'not_eligible'
        else 'pending'
      end;

-- ---------------------------------------------------------------- payments
alter table public.payments
  add column if not exists needs_refund boolean not null default false,
  add column if not exists needs_refund_reason text,
  add column if not exists needs_refund_at timestamptz;

create index if not exists payments_needs_refund_idx
  on public.payments (needs_refund) where needs_refund;

create index if not exists ownerships_activation_idx
  on public.ownerships (placement_status, activation_deadline);

create index if not exists payouts_release_idx
  on public.payouts (status, release_at);
