-- SOCIAL BID ONLY — schedule the website's payout-release endpoint hourly.
--
-- Before applying this migration, store the bearer secret in Supabase Vault
-- under this exact name:
--   PAYOUT_CRON_SECRET_SOCIAL_BID
--
-- The secret is never stored in cron.job or this migration. Post is untouched.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Expose only Social Bid's payout-cron secret to the server's service role.
create or replace function public.get_social_bid_payout_cron_secret()
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'PAYOUT_CRON_SECRET_SOCIAL_BID'
  limit 1;
$$;

revoke all on function public.get_social_bid_payout_cron_secret() from public;
revoke all on function public.get_social_bid_payout_cron_secret() from anon;
revoke all on function public.get_social_bid_payout_cron_secret() from authenticated;
grant execute on function public.get_social_bid_payout_cron_secret() to service_role;

-- The cron worker can only enqueue the fixed Social Bid HTTP request. It does
-- not return the secret and cannot read arbitrary Vault entries.
create or replace function public.run_social_bid_payout_release()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  payout_cron_secret text;
begin
  select nullif(decrypted_secret, '')
  into payout_cron_secret
  from vault.decrypted_secrets
  where name = 'PAYOUT_CRON_SECRET_SOCIAL_BID'
  limit 1;

  if payout_cron_secret is null then
    raise exception 'PAYOUT_CRON_SECRET_SOCIAL_BID is not configured';
  end if;

  return net.http_post(
    url := 'https://socialbid.co/api/public/release-payouts',
    headers := pg_catalog.jsonb_build_object(
      'Authorization', 'Bearer ' || payout_cron_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function public.run_social_bid_payout_release() from public;
revoke all on function public.run_social_bid_payout_release() from anon;
revoke all on function public.run_social_bid_payout_release() from authenticated;
grant execute on function public.run_social_bid_payout_release() to service_role, postgres;

-- Replacing a same-named job makes this migration safe to run repeatedly and
-- avoids duplicate hourly requests.
do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'social-bid-release-payouts';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'social-bid-release-payouts',
    '0 * * * *',
    'select public.run_social_bid_payout_release();'
  );
end;
$$;
