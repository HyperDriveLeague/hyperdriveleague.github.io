-- HyperDrive F1 League
-- Source version of the production transaction description formatter, applied 2026-10-25.
-- Migrations executed in Supabase:
--   detailed_pilot_contract_bank_transaction_descriptions
--   include_buyout_full_payment_and_cap_breakdown_in_bank
-- This file is provided for versioning; deployment is already complete.

CREATE OR REPLACE FUNCTION public.describe_contract_bank_movement(p_tx economic_transactions)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  act public.contract_admin_actions%rowtype;
  d public.drivers%rowtype;
  buyer text; origin text; ledger_team text;
  season_no integer; periods integer; begin_half integer; round_no integer; destination uuid;
  price numeric; clause numeric; t8_part numeric; next_part numeric;
  phase text; duration text; label text; extra text; route text; amount_txt text;
BEGIN
  IF p_tx.source_type IS NULL OR p_tx.source_type !~ '^contract_mgmt:[0-9a-fA-F-]{36}$' THEN
    RETURN p_tx.description;
  END IF;
  SELECT * INTO act FROM public.contract_admin_actions WHERE id=split_part(p_tx.source_type,':',2)::uuid;
  IF NOT FOUND THEN RETURN p_tx.description;END IF;
  SELECT * INTO d FROM public.drivers WHERE id=act.driver_id;
  SELECT t.name INTO ledger_team FROM public.team_accounts ta JOIN public.teams t ON t.id=ta.team_id WHERE ta.id=p_tx.account_id;
  IF act.payload->>'team_id' IS NOT NULL AND act.payload->>'team_id' <> '' THEN
    SELECT name INTO buyer FROM public.teams WHERE id=(act.payload->>'team_id')::uuid;
  END IF;
  IF buyer IS NULL THEN buyer:=ledger_team;END IF;
  IF act.before_contract->>'team_account_id' IS NOT NULL THEN
    SELECT t.name INTO origin FROM public.team_accounts ta JOIN public.teams t ON t.id=ta.team_id WHERE ta.id=(act.before_contract->>'team_account_id')::uuid;
  END IF;
  season_no:=coalesce((act.payload->>'season')::int,8);
  begin_half:=2*season_no+coalesce((act.payload->>'market_half')::int,0);
  periods:=coalesce((act.payload->>'halves')::int,0);
  round_no:=coalesce((act.payload->>'start_round')::int,1);
  price:=coalesce((act.payload->>'amount')::numeric,0);
  phase:='T'||season_no::text||CASE WHEN coalesce((act.payload->>'market_half')::int,0)=1 THEN ' (2.ª mitad)' ELSE ' (1.ª mitad)' END;
  duration:=CASE periods WHEN 1 THEN '0,5 temporada' WHEN 2 THEN '1 temporada' WHEN 3 THEN '1,5 temporadas' WHEN 4 THEN '2 temporadas' ELSE periods::text||' medias temporadas' END;
  amount_txt:=replace(p_tx.amount_m::text,'.',',')||' M';
  route:=coalesce(origin,'Equipo anterior')||' → '||coalesce(buyer,'Equipo nuevo');
  extra:=' · Operación '||left(act.id::text,8);
  IF act.kind='buyout' THEN
    clause:=CASE WHEN act.before_term->'periods' IS NOT NULL
      THEN round(public.contract_period_sum(act.before_term->'periods',2*season_no,coalesce((act.before_term->>'end_half')::integer,begin_half))*1.5,2)
      ELSE coalesce((act.before_contract->>'buyout_clause_m')::numeric,0) END;
    IF p_tx.category='CLÁUSULA' AND p_tx.direction='income' THEN label:='Ingreso por cláusula de rescisión';
    ELSIF p_tx.category='CLÁUSULA' THEN label:='Pago cláusula de rescisión';
    ELSE label:='Nuevo contrato tras fichaje por cláusula'; END IF;
    RETURN label||' · Piloto: '||coalesce(d.nickname,'Sin identificar')||
      ' · '||route||
      ' · Movimiento: '||amount_txt||
      ' · Cláusula: '||replace(clause::text,'.',',')||' M'||
      ' · Contrato nuevo: '||replace(price::text,'.',',')||' M ('||duration||')'||
      ' · Total pagado ahora por '||coalesce(buyer,'comprador')||': '||replace((price+clause)::text,'.',',')||' M'||
      ' · Cap T'||season_no||': '||replace(public.contract_period_sum(public.contract_split_periods(begin_half,periods,price),2*season_no,2*season_no+1)::text,'.',',')||' M'||
      ' · Cap T'||(season_no+1)||': '||replace(public.contract_period_sum(public.contract_split_periods(begin_half,periods,price),2*(season_no+1),2*(season_no+1)+1)::text,'.',',')||' M'||
      ' · '||phase||', R'||round_no||extra;
  ELSIF act.kind='new' THEN
    label:='Nuevo contrato';
  ELSIF act.kind='extend' THEN
    label:='Ampliación de contrato';
  ELSIF act.kind='raise' THEN
    label:='Aumento de valor y cláusula';
  ELSIF act.kind='dismiss_voluntary' THEN
    label:='Rescisión voluntaria: pago de cláusula';
  ELSIF act.kind='dismiss_attendance' THEN
    label:='Despido por asistencia: devolución proporcional';
  ELSE RETURN p_tx.description;
  END IF;
  extra:=' · '||phase||extra;
  IF act.kind='new' THEN
    extra:=' · '||duration||' · desde R'||round_no||extra;
    IF periods BETWEEN 1 AND 4 AND price>0 THEN
      t8_part:=public.contract_period_sum(public.contract_split_periods(begin_half,periods,price),2*season_no,2*season_no+1);
      next_part:=public.contract_period_sum(public.contract_split_periods(begin_half,periods,price),2*(season_no+1),2*(season_no+1)+1);
      extra:=extra||' · Cap T'||season_no||': '||replace(t8_part::text,'.',',')||
        ' M; T'||(season_no+1)||': '||replace(next_part::text,'.',',')||' M';
    END IF;
  ELSIF act.kind='extend' THEN
    extra:=' · +'||duration||' de duración'||extra;
  ELSIF act.kind='raise' THEN
    extra:=' · Reparto: '||CASE WHEN act.payload->>'allocation'='spread' THEN 'entre periodos restantes' ELSE 'última media temporada' END||extra;
  ELSE
    extra:=' · Desde R'||round_no||
      CASE WHEN act.payload->'quote'->>'cap_released_this_season_m' IS NOT NULL THEN
        ' · Cap liberado: '||replace((act.payload->'quote'->>'cap_released_this_season_m'),'.',',')||' M' ELSE '' END||extra;
  END IF;
  RETURN label||' · Piloto: '||coalesce(d.nickname,'Sin identificar')||
    ' · Equipo: '||coalesce(buyer,'Desconocido')||
    ' · Movimiento: '||amount_txt||extra;
END
$function$;

REVOKE ALL ON FUNCTION public.describe_contract_bank_movement(public.economic_transactions) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_contract_bank_movement_description()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF NEW.source_type LIKE 'contract_mgmt:%' THEN
    NEW.description:=public.describe_contract_bank_movement(NEW);
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.set_contract_bank_movement_description() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_contract_bank_movement_description ON public.economic_transactions;
CREATE TRIGGER trg_contract_bank_movement_description
BEFORE INSERT ON public.economic_transactions
FOR EACH ROW EXECUTE FUNCTION public.set_contract_bank_movement_description();

-- Update descriptions of already stored contract management transactions.
-- Does not change amount, direction, category, linked account, source or date.
UPDATE public.economic_transactions AS e
 SET description=public.describe_contract_bank_movement(e)
WHERE e.source_type LIKE 'contract_mgmt:%'
  AND EXISTS (
    SELECT 1 FROM public.contract_admin_actions a
    WHERE e.source_type='contract_mgmt:'||a.id::text
  )
  AND e.description IS DISTINCT FROM public.describe_contract_bank_movement(e);
