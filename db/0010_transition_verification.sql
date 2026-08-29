-- SOCIAL BID — ownership-transition final verification + mismatch confirmation.
-- Additive only. Safe to re-run.

-- --------------------------------------------------------------- ownerships
alter table public.ownerships
  add column if not exists final_verification_status text,
  add column if not exists final_verified_at timestamptz,
  add column if not exists final_verification_checked_at timestamptz,
  add column if not exists final_verification_error text,
  add column if not exists final_verification_attempts integer not null default 0,
  add column if not exists mismatch_pending_since timestamptz,
  add column if not exists mismatch_recheck_at timestamptz,
  add column if not exists mismatch_reason text;

comment on column public.ownerships.final_verification_status is
  'verified | failed | unresolved. Result of the fresh X read taken at the moment this ownership was outbid.';
comment on column public.ownerships.mismatch_pending_since is
  'First confirmed mismatch on a live placement. Terminal non-compliance only runs after a second confirming read.';

-- ------------------------------------------------------------------ payouts
alter table public.payouts
  add column if not exists final_verification_status text,
  add column if not exists final_verified_at timestamptz;

-- Legacy rows: ownerships that already ended legitimately before this feature
-- existed keep their historical verification as the transition proof.
-- Guarded: earlier migrations may not have run yet on this database.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ownerships'
      and column_name = 'first_verified_at'
  ) then
    execute $q$
      update public.ownerships o
        set final_verification_status = 'verified',
            final_verified_at = coalesce(
              nullif(to_jsonb(o) ->> 'last_bio_verified_at', '')::timestamptz,
              nullif(to_jsonb(o) ->> 'placement_ended_at', '')::timestamptz,
              o.ended_at
            )
        where o.final_verification_status is null
          and o.status <> 'active'
          and o.first_verified_at is not null
          and coalesce(to_jsonb(o) ->> 'placement_end_reason', 'outbid') = 'outbid'
          and coalesce(to_jsonb(o) ->> 'bio_verification_status', 'verified') <> 'failed'
    $q$;

    execute $q$
      update public.payouts p
        set final_verification_status = o.final_verification_status,
            final_verified_at = o.final_verified_at
        from public.ownerships o
        where o.payment_id = p.payment_id
          and p.final_verification_status is null
          and o.final_verification_status is not null
    $q$;
  end if;
end $$;


create index if not exists ownerships_final_verification_idx
  on public.ownerships (final_verification_status)
  where final_verification_status = 'unresolved';

create index if not exists ownerships_mismatch_pending_idx
  on public.ownerships (mismatch_recheck_at)
  where mismatch_pending_since is not null;
