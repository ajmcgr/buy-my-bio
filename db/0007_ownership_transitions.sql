-- BUY MY BIO — ownership transition tracking.
-- A legitimate outbid ends the previous placement normally and must NEVER
-- cancel that buyer's creator payout. Safe to re-run.

alter table public.ownerships
  add column if not exists placement_started_at timestamptz,
  add column if not exists placement_ended_at timestamptz,
  add column if not exists placement_end_reason text;

update public.ownerships
  set placement_started_at = coalesce(placement_started_at, started_at)
  where placement_started_at is null;

update public.ownerships
  set placement_ended_at = ended_at,
      placement_end_reason = coalesce(placement_end_reason, 'outbid')
  where status = 'ended' and placement_ended_at is null;

-- Any ownership that leaves 'active' without an explicit reason ended because
-- a newer buyer legitimately paid more.
create or replace function public.ownership_mark_end()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from 'active' and old.status = 'active' then
    new.placement_ended_at := coalesce(new.placement_ended_at, now());
    new.placement_end_reason := coalesce(new.placement_end_reason, 'outbid');
  end if;
  if new.placement_started_at is null then
    new.placement_started_at := coalesce(new.started_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists ownerships_mark_end on public.ownerships;
create trigger ownerships_mark_end
  before update on public.ownerships
  for each row execute function public.ownership_mark_end();

comment on column public.ownerships.placement_end_reason is
  'outbid = legitimate ownership change (payout stays eligible); seller_removed = creator non-compliance (payout ineligible).';
