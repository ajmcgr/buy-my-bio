-- Define the settlement RPC explicitly rather than attempting to modify a
-- function which may not have been deployed by an earlier migration.
-- Only the server-side Stripe settlement flow may call this function.
create or replace function public.apply_takeover(_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

  -- A browser or untrusted client cannot turn a created payment into an
  -- ownership. settleCheckoutSession verifies Stripe first, then marks it paid.
  if p.status <> 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'payment_not_confirmed');
  end if;

  -- Lock the listing so simultaneous takeovers serialize.
  select * into l from public.listings where id = p.listing_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'listing_not_found');
  end if;
  if l.status <> 'active' then
    update public.payments set status = 'stale', flagged = true,
      admin_notes = coalesce(admin_notes, '') || ' listing not active', updated_at = now()
    where id = p.id;
    return jsonb_build_object('ok', false, 'reason', 'listing_not_active');
  end if;

  select * into prev from public.ownerships
    where listing_id = l.id and status = 'active' for update;

  required := case when prev.id is null then l.starting_price_cents
                   else public.next_price_cents(prev.amount_cents, l.minimum_increase_percentage) end;

  if p.amount_cents < required then
    update public.payments set status = 'stale', flagged = true,
      admin_notes = coalesce(admin_notes, '') ||
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

revoke execute on function public.apply_takeover(uuid) from public;
revoke execute on function public.apply_takeover(uuid) from anon;
revoke execute on function public.apply_takeover(uuid) from authenticated;
grant execute on function public.apply_takeover(uuid) to service_role;
