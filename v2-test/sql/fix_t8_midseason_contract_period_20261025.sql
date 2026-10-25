-- HyperDrive F1 League — correction of T8 midseason contract period
-- Applied in Supabase production: 2026-10-25.
-- This is an audit copy, not a script to replay without checking production state.
--
-- Investigation: Matahary's new Williams contract began at round 7 but was
-- submitted with market_half=0 (period 16) rather than market_half=1 (period 17).
-- Manu's McLaren contract was already correct (period 17).
--
-- The live correction updated exactly:
--   public.contract_terms: start_half 16 -> 17, end_half 16 -> 17,
--      periods [{"half":16,"amount":20}] -> [{"half":17,"amount":20}]
--   public.driver_contracts: start label "T8 MEDIA", end label "T8"
--   public.contract_admin_actions: payload.market_half 0 -> 1
--
-- Verified unchanged: contract value 20 M, buyout 30 M, Williams bank balance
-- 102.50 M, salary cap in use 464.00 M, transaction ledger and race roster.
--
-- Prevent recurrence at the database boundary:
-- This appends a guard to the existing admin_contract_apply function and
-- does not replace its contractual logic or permissions.

DO $patch$
DECLARE
  ddl text;
  expected text := E' IF v_market_half=1 AND v_kind IN (\'new\',\'buyout\') AND v_round<7 THEN';
  insert_guard text := E' IF v_market_half=0 AND v_kind IN (\'new\',\'buyout\') AND v_round>=7 THEN\n   RAISE EXCEPTION \'Desde la ronda 7, selecciona el mercado de mitad de temporada antes de registrar un fichaje\';\n END IF;\n';
BEGIN
  SELECT pg_get_functiondef('public.admin_contract_apply(jsonb)'::regprocedure) INTO ddl;
  IF position('Desde la ronda 7, selecciona el mercado de mitad de temporada' IN ddl)>0 THEN
    RETURN;
  END IF;
  IF position(expected IN ddl)=0 THEN
    RAISE EXCEPTION 'Unexpected admin_contract_apply source. Aborting.';
  END IF;
  EXECUTE replace(ddl,expected,insert_guard||expected);
END $patch$;

-- Supabase production migration name:
-- reject_first_half_contract_signings_starting_round_seven
--
-- Frontend changes:
--   v2-test/js/admin-contracts.js validates round/midseason selection and
--   checks both start_half and end_half when displaying active contracts.
--   v2-test/admin.html defaults to the midseason market and loads
--   admin-contracts.js?v=9 to bypass browser caching.
