create or replace function public.admin_previous_wagering_events()
returns table(id uuid, season_number integer, round_number integer, division text, grand_prix text, is_suspended boolean)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or not public.has_role('admin') then raise exception 'No autorizado'; end if;
  return query
  with previous as (
    select e.season_number,e.round_number from public.wagering_events e
    group by e.season_number,e.round_number
    having max(e.race_at)<=now() and max(e.closes_at)<=now() and bool_or(e.status<>'settled' and not e.is_suspended)
    order by e.season_number,e.round_number limit 1
  )
  select e.id,e.season_number,e.round_number,e.division::text,e.grand_prix::text,e.is_suspended
  from public.wagering_events e join previous p using(season_number,round_number)
  where e.status<>'settled' order by e.division;
end; $$;
revoke all on function public.admin_previous_wagering_events() from public,anon;
grant execute on function public.admin_previous_wagering_events() to authenticated;

CREATE OR REPLACE FUNCTION public.admin_wagering_history_v2(p_view text DEFAULT 'current'::text, p_limit integer DEFAULT 150, p_offset integer DEFAULT 0, p_product text DEFAULT 'all'::text, p_division text DEFAULT 'all'::text, p_round_number integer DEFAULT NULL::integer)
 RETURNS TABLE(activity_type text, reference_id uuid, driver_id uuid, driver_name text, race_number integer, season_number integer, round_number integer, division text, grand_prix text, amount_m numeric, potential_return_m numeric, payout_m numeric, status text, activity_at timestamp with time zone, settled_at timestamp with time zone, detail text, details jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE v_current_round integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_view NOT IN ('current','settled','previous') THEN
    RAISE EXCEPTION 'Vista no válida';
  END IF;
  IF p_view = 'current' THEN
    SELECT max(e.round_number) INTO v_current_round
    FROM public.wagering_events e
    WHERE e.season_number = 8
      AND e.opens_at <= now()
      AND e.status <> 'settled';
  END IF;

  RETURN QUERY
  SELECT a.activity_type,a.reference_id,a.driver_id,a.driver_name,a.race_number,
         a.season_number,a.round_number,a.division,a.grand_prix,a.amount_m,
         a.potential_return_m,a.payout_m,a.status,a.activity_at,a.settled_at,
         a.detail,a.details
  FROM (
    SELECT
      'hyperbet'::text AS activity_type,b.id AS reference_id,
      d.id AS driver_id,d.nickname AS driver_name,d.race_number,
      e.season_number,e.round_number,e.division,e.grand_prix,
      b.stake_m AS amount_m,b.potential_return_m,b.payout_m,b.status,
      b.placed_at AS activity_at,b.settled_at,
      CASE WHEN b.bet_type='combo' THEN 'Combinada' ELSE 'Sencilla' END::text AS detail,
      jsonb_build_object(
        'bet_type',b.bet_type,'combined_odds',b.combined_odds,
        'legs',COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
              'market',m.title,'selection',s.selection_label,
              'team',s.team_label,'odds',leg.odds_taken,
              'result',leg.result_status,
              'opponent',op.nickname
            ) ORDER BY m.sort_order,s.sort_order,leg.id)
          FROM public.hyperbet_bet_legs leg
          JOIN public.hyperbet_selections s ON s.id=leg.selection_id
          JOIN public.hyperbet_markets m ON m.id=s.market_id
          LEFT JOIN public.drivers op ON op.id=s.opponent_driver_id
          WHERE leg.bet_id=b.id
        ),'[]'::jsonb)
      ) AS details,
      e.status AS event_status
    FROM public.hyperbet_bets b
    JOIN public.driver_accounts da ON da.id=b.driver_account_id
    JOIN public.drivers d ON d.id=da.driver_id
    JOIN public.wagering_events e ON e.id=b.event_id

    UNION ALL

    SELECT
      'hyperloto'::text AS activity_type,t.id AS reference_id,
      d.id AS driver_id,d.nickname AS driver_name,d.race_number,
      e.season_number,e.round_number,e.division,e.grand_prix,
      t.ticket_price_m AS amount_m,NULL::numeric AS potential_return_m,
      t.payout_m,t.status,t.purchased_at AS activity_at,t.settled_at,
      CASE WHEN t.status='settled' THEN coalesce(t.exact_position_hits,0)::text||' posiciones exactas' ELSE 'Boleto' END::text AS detail,
      jsonb_build_object(
        'pole',pole.nickname,'fastest_lap',fast.nickname,
        'top10',COALESCE((
          SELECT jsonb_agg(jsonb_build_object('position',pred.ordinality,'driver',pd.nickname) ORDER BY pred.ordinality)
          FROM unnest(t.predicted_top10) WITH ORDINALITY AS pred(driver_id,ordinality)
          LEFT JOIN public.drivers pd ON pd.id=pred.driver_id
        ),'[]'::jsonb),
        'pole_hit',t.pole_hit,'fastest_lap_hit',t.fastest_lap_hit,
        'exact_position_hits',t.exact_position_hits,
        'reintegro_m',t.reintegro_m,
        'category_prize_m',t.category_prize_m,
        'jackpot_prize_m',t.jackpot_prize_m
      ) AS details,
      e.status AS event_status
    FROM public.hyperloto_tickets t
    JOIN public.driver_accounts da ON da.id=t.driver_account_id
    JOIN public.drivers d ON d.id=da.driver_id
    JOIN public.hyperloto_draws dr ON dr.id=t.draw_id
    JOIN public.wagering_events e ON e.id=dr.event_id
    LEFT JOIN public.drivers pole ON pole.id=t.pole_driver_id
    LEFT JOIN public.drivers fast ON fast.id=t.fastest_lap_driver_id
  ) a
  WHERE (p_product IS NULL OR p_product='all' OR a.activity_type=p_product)
    AND (p_division IS NULL OR p_division='all' OR a.division=p_division)
    AND (p_round_number IS NULL OR a.round_number=p_round_number)
    AND (
      (p_view='current' AND a.season_number=8 AND a.round_number=v_current_round
        AND a.status='pending' AND a.event_status<>'settled')
      OR
      (p_view='previous' AND a.status='pending' AND EXISTS (
        SELECT 1 FROM public.admin_previous_wagering_events() ev
        WHERE ev.season_number=a.season_number AND ev.round_number=a.round_number AND ev.division=a.division
      ))
      OR
      (p_view='settled' AND a.status<>'pending' AND a.event_status='settled')
    )
  ORDER BY CASE WHEN p_view='settled' THEN COALESCE(a.settled_at,a.activity_at) ELSE a.activity_at END DESC,
           a.reference_id DESC
  LIMIT greatest(1,least(coalesce(p_limit,150),500))
  OFFSET greatest(0,coalesce(p_offset,0));
END;
$function$
;
CREATE OR REPLACE FUNCTION public.system_settle_wagering_event(p_event_id uuid, p_actual_positions jsonb, p_actual_pole_driver_id uuid, p_actual_fastest_driver_id uuid, p_loto_top10 uuid[], p_loto_pole_driver_id uuid, p_loto_fastest_driver_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e public.wagering_events%rowtype;
  v_draw_id uuid;
  v_ticket_price numeric(12,2);
  v_direct_pct numeric;
  v_reset numeric(12,2);
  v_gross numeric(12,2);
  v_refunds numeric(12,2);
  v_remaining numeric(12,2);
  v_direct numeric(12,2);
  v_prize_pool numeric(12,2);
  v_unclaimed numeric(12,2) := 0;
  v_allocation numeric(12,2);
  v_winner_count integer;
  v_jackpot_before numeric(12,2);
  v_jackpot_total numeric(12,2);
  v_jackpot_winners integer;
  v_each_jackpot numeric(12,2);
  v_leftover numeric(12,2);
  v_first_ticket uuid;
  r record;
  b record;
  t record;
  v_won_count integer;
  v_lost_count integer;
  v_void_count integer;
  v_leg_count integer;
  v_absent_leg_count integer;
  v_payout numeric(12,2);
  v_odds numeric;
  v_odds_cap numeric;
  v_return_cap numeric;
begin
  select * into e from public.wagering_events where id=p_event_id for update;
  if e.id is null then raise exception 'Evento no encontrado.'; end if;
  if e.status='settled' then return 'already_settled'; end if;
  if e.is_suspended then return 'suspended'; end if;
  if e.race_at > now() or e.closes_at > now() then raise exception 'La ronda aún no se ha disputado.'; end if;
  if cardinality(p_loto_top10)<>10 then raise exception 'Top 10 HyperLoto inválido.'; end if;

  update public.hyperbet_selections s
  set result_status = case
    -- An official driver missing from the MAIN RACE export makes the pick void.
    -- Qualifying/sprint appearances do not count as having taken part in the race.
    when not (p_actual_positions ? s.driver_id::text) then 'void'
    when m.market_type='head_to_head' and
         (s.opponent_driver_id is null or
          not (p_actual_positions ? s.opponent_driver_id::text)) then 'void'
    when m.market_type='winner' then
      case when coalesce((p_actual_positions->>s.driver_id::text)::int,9999)=1 then 'won' else 'lost' end
    when m.market_type='podium' then
      case when coalesce((p_actual_positions->>s.driver_id::text)::int,9999)<=3 then 'won' else 'lost' end
    when m.market_type='top5' then
      case when coalesce((p_actual_positions->>s.driver_id::text)::int,9999)<=5 then 'won' else 'lost' end
    when m.market_type='top10' then
      case when coalesce((p_actual_positions->>s.driver_id::text)::int,9999)<=10 then 'won' else 'lost' end
    when m.market_type='pole' and e.season_number=8 and e.round_number=9 then 'void'
    when m.market_type='pole' then
      case when p_actual_pole_driver_id is not null and s.driver_id=p_actual_pole_driver_id then 'won' else 'lost' end
    when m.market_type='fastest_lap' then
      case when p_actual_fastest_driver_id is not null and s.driver_id=p_actual_fastest_driver_id then 'won' else 'lost' end
    when m.market_type='head_to_head' then
      case
        when (p_actual_positions ? s.driver_id::text) is false
          or s.opponent_driver_id is null
          or (p_actual_positions ? s.opponent_driver_id::text) is false then 'void'
        when (p_actual_positions->>s.driver_id::text)::int < (p_actual_positions->>s.opponent_driver_id::text)::int then 'won'
        else 'lost'
      end
    else 'void'
  end
  from public.hyperbet_markets m
  where s.market_id=m.id and m.event_id=p_event_id and s.result_status='pending';

  update public.hyperbet_bet_legs bl
  set result_status=s.result_status
  from public.hyperbet_selections s
  join public.hyperbet_markets m on m.id=s.market_id
  where bl.selection_id=s.id and m.event_id=p_event_id and bl.result_status='pending';

  for b in
    select * from public.hyperbet_bets
    where event_id=p_event_id and status='pending'
    for update
  loop
    select count(*),
           count(*) filter(where result_status='won'),
           count(*) filter(where result_status='lost'),
           count(*) filter(where result_status='void'),
           coalesce(exp(sum(ln(odds_taken)) filter(where result_status='won')),1)
    into v_leg_count,v_won_count,v_lost_count,v_void_count,v_odds
    from public.hyperbet_bet_legs
    where bet_id=b.id;

    select count(*) into v_absent_leg_count
    from public.hyperbet_bet_legs bl
    join public.hyperbet_selections s on s.id=bl.selection_id
    join public.hyperbet_markets m on m.id=s.market_id
    where bl.bet_id=b.id
      and (
        not (p_actual_positions ? s.driver_id::text)
        or (m.market_type='head_to_head'
           and (s.opponent_driver_id is null
                or not (p_actual_positions ? s.opponent_driver_id::text)))
      );

    if v_absent_leg_count>0 then
      -- Whole stake back, including combos with another losing leg.
      v_payout:=b.stake_m;
      update public.hyperbet_bets
      set status='void',payout_m=v_payout,settled_at=now()
      where id=b.id;
      insert into public.driver_bank_transactions(
        driver_account_id,description,category,direction,amount_m,source_type,source_id,
        season_number,round_number
      ) values(
        b.driver_account_id,'Devolución por piloto ausente',
        'HyperBet','income',v_payout,'hyperbet_payout',b.id,
        e.season_number,e.round_number
      ) on conflict do nothing;
    elsif v_lost_count>0 then
      update public.hyperbet_bets set status='lost',payout_m=0,settled_at=now() where id=b.id;
    elsif v_void_count=v_leg_count then
      v_payout:=b.stake_m;
      update public.hyperbet_bets set status='void',payout_m=v_payout,settled_at=now() where id=b.id;
      insert into public.driver_bank_transactions(
        driver_account_id,description,category,direction,amount_m,source_type,source_id
      ) values(
        b.driver_account_id,'Apuesta HyperBet anulada','HyperBet','income',v_payout,'hyperbet_payout',b.id
      ) on conflict do nothing;
    else
      select
        case when b.bet_type='simple' then max_simple_odds else max_combo_odds end,
        case when b.bet_type='simple' then max_simple_return_m else max_combo_return_m end
      into v_odds_cap,v_return_cap
      from public.hyperbet_settings where id=true;

      v_payout:=round(b.stake_m*least(round(v_odds,2),v_odds_cap),2);

      update public.hyperbet_bets set status='won',payout_m=v_payout,settled_at=now() where id=b.id;
      insert into public.driver_bank_transactions(
        driver_account_id,description,category,direction,amount_m,source_type,source_id
      ) values(
        b.driver_account_id,'Premio HyperBet','HyperBet','income',v_payout,'hyperbet_payout',b.id
      ) on conflict do nothing;
    end if;
  end loop;

  update public.hyperbet_markets set status='settled'
  where event_id=p_event_id and status<>'void';

  select id into v_draw_id from public.hyperloto_draws where event_id=p_event_id;
  if v_draw_id is not null then
    select ticket_price_m,direct_jackpot_pct,jackpot_reset_m
    into v_ticket_price,v_direct_pct,v_reset
    from public.hyperloto_settings where id=true;

    update public.hyperloto_tickets ht
    set exact_position_hits=(
          select count(*) from generate_subscripts(ht.predicted_top10,1) i
          where ht.predicted_top10[i]=p_loto_top10[i]
        ),
        pole_hit=(ht.pole_driver_id=p_loto_pole_driver_id),
        fastest_lap_hit=(ht.fastest_lap_driver_id=p_loto_fastest_driver_id),
        reintegro_m=case when ht.pole_driver_id=p_loto_pole_driver_id then ht.ticket_price_m else 0 end
    where ht.draw_id=v_draw_id and ht.status='pending';

    select coalesce(sum(ticket_price_m),0),coalesce(sum(reintegro_m),0)
    into v_gross,v_refunds
    from public.hyperloto_tickets where draw_id=v_draw_id and status='pending';

    v_remaining:=greatest(v_gross-v_refunds,0);
    v_direct:=round(v_remaining*v_direct_pct,2);
    v_prize_pool:=v_remaining-v_direct;

    for r in select * from public.hyperloto_prize_rules order by exact_hits desc loop
      v_allocation:=round(v_prize_pool*r.pool_share,2);
      select count(*) into v_winner_count
      from public.hyperloto_tickets
      where draw_id=v_draw_id and status='pending' and exact_position_hits=r.exact_hits;

      if v_winner_count=0 then
        v_unclaimed:=v_unclaimed+v_allocation;
      else
        update public.hyperloto_tickets
        set category_prize_m=round(v_allocation/v_winner_count,2)
        where draw_id=v_draw_id and status='pending' and exact_position_hits=r.exact_hits;
      end if;
    end loop;

    select current_m into v_jackpot_before
    from public.hyperloto_jackpots where division=e.division for update;

    v_jackpot_total:=v_jackpot_before+v_direct+v_unclaimed;

    select count(*) into v_jackpot_winners
    from public.hyperloto_tickets
    where draw_id=v_draw_id and status='pending'
      and exact_position_hits=10 and pole_hit=true and fastest_lap_hit=true;

    if v_jackpot_winners>0 then
      v_each_jackpot:=trunc(v_jackpot_total/v_jackpot_winners,2);
      update public.hyperloto_tickets
      set jackpot_prize_m=v_each_jackpot
      where draw_id=v_draw_id and status='pending'
        and exact_position_hits=10 and pole_hit=true and fastest_lap_hit=true;

      select id into v_first_ticket
      from public.hyperloto_tickets
      where draw_id=v_draw_id and status='pending'
        and exact_position_hits=10 and pole_hit=true and fastest_lap_hit=true
      order by purchased_at,id
      limit 1;

      v_leftover:=v_jackpot_total-(v_each_jackpot*v_jackpot_winners);
      if v_leftover>0 and v_first_ticket is not null then
        update public.hyperloto_tickets
        set jackpot_prize_m=jackpot_prize_m+v_leftover
        where id=v_first_ticket;
      end if;

      update public.hyperloto_jackpots
      set current_m=v_reset,last_won_at=now(),updated_at=now()
      where division=e.division;
    else
      update public.hyperloto_jackpots
      set current_m=v_jackpot_total,updated_at=now()
      where division=e.division;
    end if;

    update public.hyperloto_tickets
    set payout_m=reintegro_m+category_prize_m+jackpot_prize_m,
        status='settled',settled_at=now()
    where draw_id=v_draw_id and status='pending';

    for t in
      select * from public.hyperloto_tickets
      where draw_id=v_draw_id and status='settled' and payout_m>0
    loop
      insert into public.driver_bank_transactions(
        driver_account_id,description,category,direction,amount_m,source_type,source_id
      ) values(
        t.driver_account_id,
        case when t.jackpot_prize_m>0 then 'Premio HyperLoto · JACKPOT'
             when t.category_prize_m>0 then 'Premio HyperLoto'
             else 'Reintegro HyperLoto' end,
        'HyperLoto','income',t.payout_m,'hyperloto_payout',t.id
      ) on conflict do nothing;
    end loop;

    update public.hyperloto_draws
    set gross_sales_m=v_gross,
        pole_refunds_m=v_refunds,
        ordinary_prize_pool_m=v_prize_pool,
        jackpot_contribution_m=v_direct+v_unclaimed,
        jackpot_payout_m=case when v_jackpot_winners>0 then v_jackpot_total else 0 end,
        settled_at=now()
    where id=v_draw_id;
  end if;

  update public.wagering_events
  set status='settled',settled_at=now(),updated_at=now()
  where id=p_event_id;

  return 'settled';
end;
$function$
;
revoke all on function public.system_settle_wagering_event(uuid,jsonb,uuid,uuid,uuid[],uuid,uuid) from public, anon, authenticated;
grant execute on function public.system_settle_wagering_event(uuid,jsonb,uuid,uuid,uuid[],uuid,uuid) to service_role;