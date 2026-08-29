-- Lock takeover application to confirmed server-side Stripe settlement only.
do $$
declare
  function_sql text;
begin
  select pg_get_functiondef('public.apply_takeover(uuid)'::regprocedure) into function_sql;
  if position('p.status <> ''paid''' in function_sql) = 0 then
    function_sql := replace(
      function_sql,
      '  -- lock the listing so simultaneous takeovers serialize',
      '  if p.status <> ''paid'' then
    return jsonb_build_object(''ok'', false, ''reason'', ''payment_not_confirmed'');
  end if;

  -- lock the listing so simultaneous takeovers serialize'
    );
    execute function_sql;
  end if;
end $$;

revoke execute on function public.apply_takeover(uuid) from public;
revoke execute on function public.apply_takeover(uuid) from anon;
revoke execute on function public.apply_takeover(uuid) from authenticated;
grant execute on function public.apply_takeover(uuid) to service_role;
