-- Durable, idempotent delivery tracking for post-takeover emails.
create table if not exists public.payment_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  email_type text not null check (email_type in ('winner', 'activation_buyer', 'activation_creator')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0,
  provider_id text,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_id, email_type)
);

grant all on public.payment_email_deliveries to service_role;
alter table public.payment_email_deliveries enable row level security;

create index if not exists payment_email_deliveries_pending_idx
  on public.payment_email_deliveries (payment_id, status);
