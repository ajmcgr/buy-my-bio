-- Buyer-supplied bio message: the EXACT text the creator must have live in
-- their X bio. This is what the release job verifies before paying out.

alter table public.payments   add column if not exists bio_message text;
alter table public.ownerships add column if not exists bio_message text;

-- Carry the message onto the ownership row when a takeover is applied.
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
  return new;
end;
$$;

drop trigger if exists ownerships_sync_bio_message on public.ownerships;
create trigger ownerships_sync_bio_message
  before insert on public.ownerships
  for each row execute function public.sync_ownership_bio_message();
