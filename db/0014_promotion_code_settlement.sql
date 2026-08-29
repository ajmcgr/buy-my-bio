-- Keep the sponsorship bid separate from the amount Stripe actually collected.
-- `payments.amount_cents` remains the quoted bid used by apply_takeover and
-- marketplace ranking. `actual_paid_cents` is the final Checkout total after
-- any Stripe promotion-code discount and is the only amount available for a
-- creator payout.
alter table public.payments
  add column if not exists actual_paid_cents integer
    check (actual_paid_cents is null or actual_paid_cents >= 0);

comment on column public.payments.actual_paid_cents is
  'Authoritative Stripe Checkout amount_total after discounts. payments.amount_cents remains the sponsorship bid.';
