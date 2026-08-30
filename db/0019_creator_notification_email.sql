-- SOCIAL BID — explicit creator notification email.
-- X OAuth supplies identity/profile data only. This private, service-role-only
-- table is the sole recipient source for creator notifications and does not
-- affect Post.

create table if not exists public.creator_notification_emails (
  creator_id uuid primary key references public.creators(id) on delete cascade,
  notification_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on public.creator_notification_emails from public, anon, authenticated;
grant all on public.creator_notification_emails to service_role;
alter table public.creator_notification_emails enable row level security;

-- No anon/authenticated policies or grants: existing synthetic Auth emails are
-- deliberately not copied here, so they are treated as notification_email = null.
