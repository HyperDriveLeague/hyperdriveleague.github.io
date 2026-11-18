create table public.staff_gp_prizes (
 id uuid primary key default gen_random_uuid(),
 season_number integer not null check(season_number>0),
 round_number integer not null check(round_number>0),
 division text not null check(division in ('hyperdrive','academy')),
 prize_type text not null check(prize_type in ('winner','pole')),
 driver_id uuid references public.drivers(id),
 driver_name text not null,
 team_id uuid not null references public.teams(id),
 amount_m numeric not null,
 transaction_id uuid not null references public.economic_transactions(id),
 result_snapshot jsonb not null,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique(season_number,round_number,division,prize_type)
);
alter table public.staff_gp_prizes enable row level security;
create policy staff_read_gp_prizes on public.staff_gp_prizes for select to authenticated using(public.is_staff_or_admin());
grant select on public.staff_gp_prizes to authenticated;
create or replace function public.staff_award_gp_prize(
 p_season integer,p_round integer,p_division text,p_type text,p_driver_id uuid,p_driver_name text,p_team_id uuid,p_result jsonb
) returns uuid language plpgsql security definer set search_path=public,auth as $$
declare v_id uuid;v_account uuid;v_team uuid;v_amount numeric;v_tx uuid;v_info jsonb;v_position integer;
begin
 if auth.uid() is null or not public.is_staff_or_admin() then raise exception 'No autorizado'; end if;
 if p_season is null or p_season<1 or p_round is null or p_round<1 or p_division is null or p_division not in ('hyperdrive','academy') or p_type is null or p_type not in ('winner','pole') then raise exception 'Premio no válido'; end if;
 if nullif(trim(p_driver_name),'') is null then raise exception 'Falta el piloto'; end if;
 v_info:=p_result->'sessionInfo';
 v_position:=coalesce((p_result->'driver'->>'classificationPosition')::integer,(p_result->'driver'->>'position')::integer);
 if coalesce((p_result->>'round')::integer,0)<>p_round or coalesce(v_info->>'completedStatus','')<>'Completed' or coalesce(v_position,0)<>1
 or coalesce(p_result->'driver'->>'driverName','')<>p_driver_name then raise exception 'Resultados incompletos'; end if;
 if p_type='winner' and (coalesce(v_info->>'sessionType','')<>'Race' or coalesce(v_info->>'raceType','')<>'Main') then raise exception 'Solo se premia el GP principal'; end if;
 if p_type='pole' and (coalesce(v_info->>'sessionType','')<>'Qualification' or (p_season=8 and p_round=9)) then raise exception 'Sin premio pole por formato sin qualy'; end if;
 perform pg_advisory_xact_lock(hashtextextended('gp-prize:'||p_season||':'||p_round||':'||p_division||':'||p_type,0));
 select id into v_id from staff_gp_prizes where season_number=p_season and round_number=p_round and division=p_division and prize_type=p_type;
 if found then return v_id; end if;
 select sr.team_id into v_team from season_roster sr where sr.season_number=p_season and sr.driver_id=p_driver_id and sr.division=p_division
 and sr.roster_status='official' and sr.start_round<=p_round and (sr.end_round is null or sr.end_round>=p_round)
 order by sr.start_round desc limit 1;
 v_team:=coalesce(v_team,p_team_id);
 if v_team is null then raise exception 'Selecciona la escudería del reserva'; end if;
 select id into v_account from team_accounts where season_number=p_season and team_id=v_team and is_active limit 1;
 if v_account is null then raise exception 'La escudería necesita una cuenta activa'; end if;
 v_amount:=case when p_division='hyperdrive' then case when p_type='winner' then 2 else 1 end else case when p_type='winner' then 1 else 0.5 end end;
 insert into economic_transactions(account_id,transaction_date,description,category,direction,amount_m,round_number,source_type,created_by)
 values(v_account,current_date,case when p_type='winner' then 'Premio ganador GP' else 'Premio pole GP' end||' · '||p_division||' · '||p_driver_name,
 'PREMIO','income',v_amount,p_round,'staff_gp_prize',auth.uid()) returning id into v_tx;
 insert into staff_gp_prizes(season_number,round_number,division,prize_type,driver_id,driver_name,team_id,amount_m,transaction_id,result_snapshot,created_by)
 values(p_season,p_round,p_division,p_type,p_driver_id,p_driver_name,v_team,v_amount,v_tx,p_result,auth.uid()) returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.staff_award_gp_prize(integer,integer,text,text,uuid,text,uuid,jsonb) from public,anon;
grant execute on function public.staff_award_gp_prize(integer,integer,text,text,uuid,text,uuid,jsonb) to authenticated;
