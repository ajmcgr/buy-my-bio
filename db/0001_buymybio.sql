-- BUY MY BIO — initial schema
-- Paste this into the Supabase SQL editor for project qfqowhetrxritoyjzzcz.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- roles
do $$ begin
  create type public.app_role as enum ('admin', 'creator');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

drop policy if exists "own roles readable" on public.user_roles;
create policy "own roles readable" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- ---------------------------------------------------------------- creators
create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  username text not null unique,
  profile_image_url text,
  bio text,
  social_platform text not null default 'x',
  social_handle text,
  social_account_id text,
  social_profile_url text,
  follower_count integer,
  verification_status text not null default 'pending'
    check (verification_status in ('pending','verified','missing','suspended')),
  last_verified_at timestamptz,
  verification_failure_count integer not null default 0,
  stripe_connect_account_id text,
  stripe_connect_status text not null default 'not_started'
    check (stripe_connect_status in ('not_started','pending','active','disabled')),
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.creators to anon, authenticated;
grant all on public.creators to service_role;
alter table public.creators enable row level security;

drop policy if exists "creators public read" on public.creators;
create policy "creators public read" on public.creators for select to anon, authenticated using (true);

drop policy if exists "creator updates own" on public.creators;
create policy "creator updates own" on public.creators
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------- listings
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null unique references public.creators(id) on delete cascade,
  slug text not null unique,
  starting_price_cents integer not null default 1000 check (starting_price_cents > 0),
  minimum_increase_percentage numeric(6,2) not null default 10.00 check (minimum_increase_percentage >= 0),
  platform_fee_percentage numeric(6,2) not null default 20.00,
  status text not null default 'draft'
    check (status in ('draft','pending','active','suspended','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.listings to anon, authenticated;
grant all on public.listings to service_role;
alter table public.listings enable row level security;

drop policy if exists "listings public read" on public.listings;
create policy "listings public read" on public.listings for select to anon, authenticated using (true);

-- ---------------------------------------------------------------- buyers
create table if not exists public.buyers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  company_name text,
  x_handle text,
  banned boolean not null default false,
  created_at timestamptz not null default now()
);

grant all on public.buyers to service_role;
alter table public.buyers enable row level security;

-- ---------------------------------------------------------------- payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid references public.buyers(id) on delete set null,
  stripe_session_id text unique,
  stripe_payment_intent text,
  amount_cents integer not null check (amount_cents > 0),
  quoted_min_cents integer not null,
  email text not null,
  company_name text not null,
  destination_url text not null,
  logo_url text,
  x_handle text,
  status text not null default 'created'
    check (status in ('created','paid','applied','stale','refunded','failed','expired')),
  refund_status text not null default 'none'
    check (refund_status in ('none','requested','refunded','declined')),
  flagged boolean not null default false,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant all on public.payments to service_role;
alter table public.payments enable row level security;

-- ---------------------------------------------------------------- ownerships
create table if not exists public.ownerships (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid references public.buyers(id) on delete set null,
  payment_id uuid unique references public.payments(id) on delete set null,
  company_name text not null,
  destination_url text not null,
  logo_url text,
  amount_cents integer not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'active' check (status in ('active','ended')),
  destination_disabled boolean not null default false,
  click_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- ONLY ONE ACTIVE OWNERSHIP PER LISTING
create unique index if not exists ownerships_one_active_per_listing
  on public.ownerships (listing_id) where (status = 'active');

grant select on public.ownerships to anon, authenticated;
grant all on public.ownerships to service_role;
alter table public.ownerships enable row level security;

drop policy if exists "ownerships public read" on public.ownerships;
create policy "ownerships public read" on public.ownerships for select to anon, authenticated using (true);

-- ---------------------------------------------------------------- clicks
create table if not exists public.clicks (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  ownership_id uuid references public.ownerships(id) on delete set null,
  creator_id uuid references public.creators(id) on delete cascade,
  referrer text,
  visitor_hash text,
  is_unique boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists clicks_ownership_idx on public.clicks (ownership_id);
create index if not exists clicks_listing_idx on public.clicks (listing_id, created_at desc);

grant all on public.clicks to service_role;
alter table public.clicks enable row level security;

-- ---------------------------------------------------------------- verification checks
create table if not exists public.verification_checks (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  status text not null,
  method text not null default 'api',
  detail text,
  checked_at timestamptz not null default now()
);

grant all on public.verification_checks to service_role;
alter table public.verification_checks enable row level security;

-- ---------------------------------------------------------------- settings
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

grant all on public.platform_settings to service_role;
alter table public.platform_settings enable row level security;

insert into public.platform_settings (key, value) values
  ('minimum_increase_percentage', '10'::jsonb),
  ('platform_fee_percentage', '20'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------- analytics
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  listing_id uuid,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant all on public.analytics_events to service_role;
alter table public.analytics_events enable row level security;

-- ---------------------------------------------------------------- pricing
create or replace function public.next_price_cents(_current_cents integer, _pct numeric)
returns integer language sql immutable as $$
  select (ceil((_current_cents::numeric * (1 + _pct / 100.0)) / 100.0) * 100)::integer
$$;

create or replace function public.required_price_cents(_listing_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select case
    when o.id is null then l.starting_price_cents
    else public.next_price_cents(o.amount_cents, l.minimum_increase_percentage)
  end
  from public.listings l
  left join public.ownerships o
    on o.listing_id = l.id and o.status = 'active'
  where l.id = _listing_id
$$;

-- ---------------------------------------------------------------- takeover (race safe)
create or replace function public.apply_takeover(_payment_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.payments%rowtype;
  l public.listings%rowtype;
  prev public.ownerships%rowtype;
  required integer;
  new_id uuid;
begin
  select * into p from public.payments where id = _payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'payment_not_found');
  end if;

  if p.status = 'applied' then
    return jsonb_build_object('ok', true, 'reason', 'already_applied');
  end if;

  -- lock the listing so simultaneous takeovers serialize
  select * into l from public.listings where id = p.listing_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'listing_not_found');
  end if;
  if l.status <> 'active' then
    update public.payments set status = 'stale', flagged = true,
      admin_notes = coalesce(admin_notes,'') || ' listing not active', updated_at = now()
    where id = p.id;
    return jsonb_build_object('ok', false, 'reason', 'listing_not_active');
  end if;

  select * into prev from public.ownerships
    where listing_id = l.id and status = 'active' for update;

  required := case when prev.id is null then l.starting_price_cents
                   else public.next_price_cents(prev.amount_cents, l.minimum_increase_percentage) end;

  if p.amount_cents < required then
    update public.payments set status = 'stale', flagged = true,
      admin_notes = coalesce(admin_notes,'') ||
        format(' stale: paid %s required %s', p.amount_cents, required),
      updated_at = now()
    where id = p.id;
    return jsonb_build_object('ok', false, 'reason', 'outbid',
      'required_cents', required, 'paid_cents', p.amount_cents,
      'previous_owner', prev.company_name);
  end if;

  if prev.id is not null then
    update public.ownerships set status = 'ended', ended_at = now() where id = prev.id;
  end if;

  insert into public.ownerships
    (listing_id, buyer_id, payment_id, company_name, destination_url, logo_url, amount_cents)
  values
    (l.id, p.buyer_id, p.id, p.company_name, p.destination_url, p.logo_url, p.amount_cents)
  returning id into new_id;

  update public.payments set status = 'applied', updated_at = now() where id = p.id;

  return jsonb_build_object(
    'ok', true,
    'ownership_id', new_id,
    'previous', case when prev.id is null then null else jsonb_build_object(
      'id', prev.id, 'company_name', prev.company_name, 'amount_cents', prev.amount_cents,
      'started_at', prev.started_at, 'click_count', prev.click_count,
      'email', (select b.email from public.buyers b where b.id = prev.buyer_id)
    ) end
  );
end;
$$;

-- ---------------------------------------------------------------- click recording
create or replace function public.record_click(
  _listing_id uuid, _ownership_id uuid, _creator_id uuid,
  _referrer text, _visitor_hash text
) returns void language plpgsql security definer set search_path = public as $$
declare
  is_new boolean := false;
begin
  if _ownership_id is not null and _visitor_hash is not null then
    is_new := not exists (
      select 1 from public.clicks
      where ownership_id = _ownership_id and visitor_hash = _visitor_hash
    );
  end if;

  insert into public.clicks (listing_id, ownership_id, creator_id, referrer, visitor_hash, is_unique)
  values (_listing_id, _ownership_id, _creator_id, _referrer, _visitor_hash, is_new);

  if _ownership_id is not null then
    update public.ownerships set click_count = click_count + 1 where id = _ownership_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------- first creator: Alex MacGregor
insert into public.creators (display_name, username, bio, social_platform, social_handle,
                             social_profile_url, verification_status, last_verified_at)
values ('Alex MacGregor', 'alex',
        'Building startups in public and documenting the process.',
        'x', 'amacg', 'https://x.com/amacg', 'verified', now())
on conflict (username) do nothing;

insert into public.listings (creator_id, slug, starting_price_cents, status)
select id, 'alex', 1000, 'active' from public.creators where username = 'alex'
on conflict (creator_id) do nothing;

-- ---------------------------------------------------------------- admin bootstrap
-- After you sign up at /auth with your admin email, run:
-- insert into public.user_roles (user_id, role)
-- select id, 'admin' from auth.users where email = 'you@example.com'
-- on conflict do nothing;
