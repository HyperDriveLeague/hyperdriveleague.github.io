alter table public.staff_sporting_sanctions add column if not exists article_details jsonb;
CREATE OR REPLACE FUNCTION public.staff_apply_multi_sporting_sanction(p_driver_id uuid, p_articles jsonb, p_team_id uuid DEFAULT NULL::uuid, p_beneficiary_team_id uuid DEFAULT NULL::uuid, p_round_number integer DEFAULT NULL::integer, p_sanction_date date DEFAULT CURRENT_DATE, p_season_number integer DEFAULT 8, p_sanction_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_article public.sporting_sanction_articles%rowtype;
  v_team_id uuid;
  v_official_team_id uuid;
  v_license_id uuid;
  v_event_id uuid;
  v_sanction_id uuid;
  v_payer_account uuid;
  v_beneficiary_account uuid;
  v_expense_id uuid;
  v_income_id uuid;
  v_driver_name text;
  v_event_type text;
  v_delta integer;
  v_item jsonb;
  v_current public.sporting_sanction_articles%rowtype;
  v_codes text[] := '{}';
  v_details jsonb := '[]';
  v_seconds numeric := 0;
  v_points integer := 0;
  v_seconds_special text[] := '{}';
  v_points_special text[] := '{}';
  v_descriptions text[] := '{}';
  v_label text;
begin
  if auth.uid() is null or not public.is_staff_or_admin() then raise exception 'Not authorized'; end if;
  if p_round_number is not null and p_round_number <= 0 then raise exception 'Invalid round'; end if;
  if p_articles is null or jsonb_typeof(p_articles)<>'array' or jsonb_array_length(p_articles)=0 then
    raise exception 'Selecciona al menos un artículo';
  end if;
  for v_item in select value from jsonb_array_elements(p_articles) loop
    select * into v_current from public.sporting_sanction_articles
    where article_code=v_item->>'code' and is_active;
    if not found then raise exception 'Artículo no válido'; end if;
    if v_current.article_code = any(v_codes) then raise exception 'Artículo repetido'; end if;
    if v_current.article_code in ('MANUAL_NO_QUALY','MANUAL_RACE_BAN') then
      raise exception 'Registra las medidas manuales NQ/RB en su formulario habitual';
    end if;
    if v_current.article_code='PERSONALIZADO' then
      if coalesce(v_item->>'points','') !~ '^[0-9]{1,2}$'
        or coalesce(length(btrim(v_item->>'description')),0) not between 3 and 500 then
        raise exception 'Indica entre 0 y 99 puntos y una descripción de 3 a 500 caracteres';
      end if;
      v_current.points_numeric:=(v_item->>'points')::integer;
      v_current.points_text:=v_current.points_numeric::text;
      v_current.description:=btrim(v_item->>'description');
    end if;
    v_codes:=array_append(v_codes,v_current.article_code);
    v_points:=v_points+coalesce(v_current.points_numeric,0);
    if v_current.points_numeric is null and v_current.points_text not in ('-','—','0') then
      v_points_special:=array_append(v_points_special,v_current.points_text);
    end if;
    if v_current.seconds_text ~ '^[0-9]+([.][0-9]+)?$' then
      v_seconds:=v_seconds+v_current.seconds_text::numeric;
    elsif v_current.seconds_text not in ('-','—','0') then
      v_seconds_special:=array_append(v_seconds_special,v_current.seconds_text);
    end if;
    v_descriptions:=array_append(v_descriptions,v_current.article_code||' · '||v_current.description);
    v_details:=v_details||jsonb_build_array(jsonb_build_object('code',v_current.article_code,
      'seconds',v_current.seconds_text,'points',v_current.points_numeric,'points_text',v_current.points_text,'description',v_current.description));
  end loop;
  v_article.article_code:=v_codes[1];
  v_article.seconds_text:=concat_ws(' + ',case when v_seconds<>0 then v_seconds::text end,nullif(array_to_string(v_seconds_special,' + '),''));
  if v_article.seconds_text='' then v_article.seconds_text:='0'; end if;
  v_article.points_numeric:=v_points;
  v_article.points_text:=concat_ws(' + ',v_points::text,nullif(array_to_string(v_points_special,' + '),''));
  v_article.description:=array_to_string(v_descriptions,E'\n');
  v_label:=array_to_string(v_codes,' + ');
  if p_sanction_id is not null then
    perform public.staff_delete_sporting_sanction(p_sanction_id);
  end if;
  select nickname into v_driver_name from public.drivers where id=p_driver_id and is_active=true;
  if v_driver_name is null then raise exception 'Driver does not exist'; end if;

  select sr.team_id into v_official_team_id
  from public.season_roster sr
  where sr.season_number=p_season_number and sr.driver_id=p_driver_id and sr.roster_status='official'
    and (case when p_round_number is null then sr.is_active else sr.start_round <= p_round_number and (sr.end_round is null or sr.end_round >= p_round_number) end)
  order by sr.is_active desc, sr.start_round desc limit 1;

  if v_official_team_id is not null then v_team_id:=v_official_team_id;
  else v_team_id:=p_team_id; if v_team_id is null then raise exception 'Reserve or unassigned driver requires a team'; end if; end if;
  if not exists(select 1 from public.teams where id=v_team_id and is_active=true) then raise exception 'Team does not exist'; end if;
  if p_beneficiary_team_id is not null then
    if p_beneficiary_team_id=v_team_id then raise exception 'Beneficiary team must be different'; end if;
    if not exists(select 1 from public.teams where id=p_beneficiary_team_id and is_active=true) then raise exception 'Beneficiary team does not exist'; end if;
  end if;

  select id into v_license_id from public.superlicenses where driver_id=p_driver_id and season_number=p_season_number and is_active=true limit 1;
  if v_license_id is null then raise exception 'Driver has no active superlicense'; end if;

  if v_article.points_numeric is not null and v_article.points_numeric > 0 then
    v_event_type := 'points_penalty'; v_delta := -v_article.points_numeric;
  else
    v_event_type := 'note'; v_delta := 0;
  end if;

  insert into public.superlicense_events(superlicense_id,round_number,event_date,event_type,points_delta,article,description,status,created_by)
  values(v_license_id,p_round_number,p_sanction_date,v_event_type,v_delta,v_label,v_article.description,'applied',auth.uid())
  returning id into v_event_id;

  if p_beneficiary_team_id is not null then
    select id into v_payer_account from public.team_accounts where team_id=v_team_id and season_number=p_season_number and is_active=true limit 1;
    select id into v_beneficiary_account from public.team_accounts where team_id=p_beneficiary_team_id and season_number=p_season_number and is_active=true limit 1;
    if v_payer_account is null or v_beneficiary_account is null then raise exception 'Both teams need an active account'; end if;
    insert into public.economic_transactions(account_id,transaction_date,description,category,direction,amount_m,round_number,source_type,created_by)
    values(v_payer_account,p_sanction_date,'Reclamación / sanción '||v_label||' · '||v_driver_name,'SANCION','expense',0.50,p_round_number,'staff_sporting_sanction',auth.uid()) returning id into v_expense_id;
    insert into public.economic_transactions(account_id,transaction_date,description,category,direction,amount_m,round_number,source_type,created_by)
    values(v_beneficiary_account,p_sanction_date,'Compensación reclamación '||v_label||' · '||v_driver_name,'SANCION','income',0.50,p_round_number,'staff_sporting_sanction',auth.uid()) returning id into v_income_id;
  end if;

  insert into public.staff_sporting_sanctions(season_number,round_number,sanction_date,article_code,driver_id,team_id,beneficiary_team_id,seconds_text,points_text,description,superlicense_event_id,team_expense_transaction_id,beneficiary_income_transaction_id,created_by,article_details)
  values(p_season_number,p_round_number,p_sanction_date,v_article.article_code,p_driver_id,v_team_id,p_beneficiary_team_id,v_article.seconds_text,v_article.points_text,v_article.description,v_event_id,v_expense_id,v_income_id,auth.uid(),v_details) returning id into v_sanction_id;

  return jsonb_build_object('sanction_id',v_sanction_id,'team_id',v_team_id,'article',v_label,'points',v_article.points_text,'seconds',v_article.seconds_text,'superlicense_event_id',v_event_id,'economic_transfer',p_beneficiary_team_id is not null);
end;
$function$
;
revoke all on function public.staff_apply_multi_sporting_sanction(uuid,jsonb,uuid,uuid,integer,date,integer,uuid) from public,anon;
grant execute on function public.staff_apply_multi_sporting_sanction(uuid,jsonb,uuid,uuid,integer,date,integer,uuid) to authenticated;
