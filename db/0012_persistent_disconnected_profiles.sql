-- Keep creator profiles in the public rankings after X is disconnected while
-- preventing new sponsorship purchases until the creator reconnects and relists.
alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status in ('draft', 'pending', 'active', 'paused', 'suspended', 'disconnected', 'rejected'));

comment on column public.listings.status is
  'disconnected keeps a creator profile publicly visible but disables new sponsorships.';

-- Preserve profiles that were hidden by the previous disconnect behavior.
update public.listings as listing
set status = 'disconnected'
from public.creators as creator
where listing.creator_id = creator.id
  and listing.status in ('active', 'suspended')
  and creator.x_account_verified = false;
