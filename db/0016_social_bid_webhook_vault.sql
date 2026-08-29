-- Social Bid only: expose exactly one Vault secret to the server's service role.
--
-- Create/update the actual `whsec_...` value through the Social Bid Supabase
-- Vault UI using this exact name:
--   STRIPE_WEBHOOK_SECRET_SOCIAL_BID
-- Never add the secret value to this migration or source control.

create or replace function public.get_social_bid_webhook_secret()
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'STRIPE_WEBHOOK_SECRET_SOCIAL_BID'
  limit 1;
$$;

revoke all on function public.get_social_bid_webhook_secret() from public;
revoke all on function public.get_social_bid_webhook_secret() from anon;
revoke all on function public.get_social_bid_webhook_secret() from authenticated;
grant execute on function public.get_social_bid_webhook_secret() to service_role;
