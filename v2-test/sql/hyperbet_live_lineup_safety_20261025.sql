-- HyperDrive F1 League / HyperBet official-roster guard
-- Applied to production on 2026-10-25.
-- Prevents NEW wagers involving a nonofficial pilot, even between hourly market syncs.
-- Leaves all prior hyperbet_bets, hyperbet_bet_legs (odds_taken),
-- hyperbet_selections, hyperloto_tickets and bank movements unchanged.
-- HyperLoto already calls wagering_official_lineup when purchasing.
-- Uses the same admin-independent authorization and existing betting rules.
-- Migration: hyperbet_block_new_wagers_on_nonofficial_drivers_keep_pending_bets
-- Verification: successful official selection in BEGIN/ROLLBACK;
-- nonofficial selection rejected in BEGIN/ROLLBACK;
-- Singapore R7 existing 4 bets and 8 legs match pre-change row hashes.

CREATE OR REPLACE FUNCTION public.hyperbet_place_bet(p_selection_ids uuid[], p_stake_m numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_account_id uuid;
  v_event_id uuid;
  v_event_count integer;
  v_leg_count integer;
  v_market_count integer;
  v_driver_count integer;
  v_combined numeric := 1;
  v_bet_type text;
  v_min numeric;
  v_max numeric;
  v_odds_cap numeric;
  v_return_cap numeric;
  v_bet_id uuid;
  v_selection record;
begin
  v_leg_count := cardinality(p_selection_ids);
  if v_leg_count is null or v_leg_count<1 or v_leg_count>5 then
    raise exception 'Una apuesta debe tener entre 1 y 5 selecciones.';
  end if;
  if p_stake_m is null or p_stake_m<=0 then
    raise exception 'Importe no válido.';
  end if;

  select da.id into v_account_id
  from public.driver_accounts da
  where da.driver_id=public.current_driver_id();

  if v_account_id is null then
    raise exception 'Necesitas un Banco del Piloto activo.';
  end if;

  select
    count(distinct m.event_id),
    (array_agg(distinct m.event_id))[1],
    count(distinct s.market_id),
    count(distinct s.driver_id)
  into v_event_count,v_event_id,v_market_count,v_driver_count
  from public.hyperbet_selections s
  join public.hyperbet_markets m on m.id=s.market_id
  where s.id=any(p_selection_ids)
    and s.is_active=true
    and m.status='open';

  if v_event_count<>1 or v_market_count<>v_leg_count then
    raise exception 'Las selecciones deben pertenecer a un único evento y a mercados distintos.';
  end if;

  if v_driver_count<>v_leg_count then
    raise exception 'No se permiten selecciones correlacionadas del mismo piloto en una combinada.';
  end if;

  if not exists (
    select 1
    from public.wagering_events e
    where e.id=v_event_id
      and not e.is_suspended
      and now()>=e.opens_at
      and now()<e.closes_at
      and e.status in ('open','upcoming')
  ) then
    raise exception 'Las apuestas de esta carrera están cerradas.';
  end if;

  -- Protection against stale odds boards between scheduled roster syncs.
  -- Existing bets remain untouched; only NEW bets require current eligibility.
  if exists (
    select 1
    from public.hyperbet_selections picked
    where picked.id=any(p_selection_ids)
      and not exists (
        select 1 from public.wagering_official_lineup(v_event_id) eligible
        where eligible.driver_id=picked.driver_id
      )
  ) then
    raise exception 'Algún piloto ya no es oficial para esta carrera. Actualiza los mercados antes de apostar.';
  end if;

  v_bet_type := case when v_leg_count=1 then 'simple' else 'combo' end;

  select
    case when v_bet_type='simple' then min_simple_stake_m else min_combo_stake_m end,
    case when v_bet_type='simple' then max_simple_stake_m else max_combo_stake_m end,
    case when v_bet_type='simple' then max_simple_odds else max_combo_odds end,
    case when v_bet_type='simple' then max_simple_return_m else max_combo_return_m end
  into v_min,v_max,v_odds_cap,v_return_cap
  from public.hyperbet_settings
  where id=true;

  if p_stake_m<v_min or p_stake_m>v_max then
    raise exception 'El importe permitido para esta apuesta es de % M a % M.',v_min,v_max;
  end if;

  if public.driver_available_balance(v_account_id)<p_stake_m then
    raise exception 'Saldo disponible insuficiente.';
  end if;

  for v_selection in
    select s.id,s.current_odds
    from public.hyperbet_selections s
    where s.id=any(p_selection_ids)
    order by s.id
  loop
    v_combined := v_combined*v_selection.current_odds;
  end loop;

  v_combined := least(round(v_combined,2),v_odds_cap);

  insert into public.hyperbet_bets(
    driver_account_id,event_id,bet_type,stake_m,combined_odds,potential_return_m
  )
  values(
    v_account_id,
    v_event_id,
    v_bet_type,
    round(p_stake_m,2),
    v_combined,
    round(p_stake_m*v_combined,2)
  )
  returning id into v_bet_id;

  insert into public.hyperbet_bet_legs(bet_id,selection_id,odds_taken)
  select v_bet_id,s.id,s.current_odds
  from public.hyperbet_selections s
  where s.id=any(p_selection_ids);

  insert into public.driver_bank_transactions(
    driver_account_id,
    description,
    category,
    direction,
    amount_m,
    source_type,
    source_id,
    created_by
  )
  values(
    v_account_id,
    case when v_bet_type='simple' then 'Apuesta HyperBet' else 'Combinada HyperBet' end,
    'HyperBet',
    'expense',
    round(p_stake_m,2),
    'hyperbet_stake',
    v_bet_id,
    auth.uid()
  );

  perform public.hyperbet_reprice_market(x.market_id)
  from (
    select distinct s.market_id
    from public.hyperbet_selections s
    where s.id=any(p_selection_ids)
  ) x;

  return v_bet_id;
end;
$function$;
