-- Sponsored-placement disclosure versioning.
--
-- New purchases require the automatic "Sponsored:" prefix in the creator's bio
-- (format v2). Placements created before this change keep format v1 so they are
-- never suddenly marked non-compliant. Additive and re-runnable.

alter table public.payments   add column if not exists placement_format text not null default 'v1';
alter table public.ownerships add column if not exists placement_format text not null default 'v1';

-- Carry message AND placement format onto the ownership row on takeover.
create or replace function public.sync_ownership_bio_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.bio_message is null then
    select p.bio_message into new.bio_message
    from public.payments p where p.id = new.payment_id;
  end if;

  if coalesce(new.placement_format, 'v1') = 'v1' then
    select coalesce(p.placement_format, 'v1') into new.placement_format
    from public.payments p where p.id = new.payment_id;
  end if;

  return new;
end;
$$;

drop trigger if exists ownerships_sync_bio_message on public.ownerships;
create trigger ownerships_sync_bio_message
  before insert on public.ownerships
  for each row execute function public.sync_ownership_bio_message();
