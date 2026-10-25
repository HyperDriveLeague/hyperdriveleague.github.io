-- HyperDrive F1 League — pilot-role automation on account linking
-- Applied to production Supabase on 2026-10-25.
--
-- Corresponding Supabase migration names:
--   sync_pilot_roles_when_driver_profile_is_linked
--   restrict_profile_pilot_role_sync_trigger_execution
--
-- A new signing, buyout or release updates season_roster, not user_roles.
-- The pilot area resolves the current team from season_roster, so transfers
-- must not replace 'pilot' with another role or change Team Principal rights.
-- Only linking/unlinking a user's profile.driver_id affects their pilot role.

CREATE OR REPLACE FUNCTION public.sync_pilot_role_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $role_sync$
BEGIN
  IF NEW.driver_id IS NOT NULL
     AND NEW.is_active
     AND NEW.application_status <> 'discarded' THEN
    INSERT INTO public.user_roles(user_id, role)
    VALUES (NEW.id, 'pilot')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = NEW.id AND role = 'pilot';
  END IF;
  RETURN NEW;
END
$role_sync$;

-- The trigger function must not be called directly through the Data API.
REVOKE ALL ON FUNCTION public.sync_pilot_role_from_profile()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_pilot_role_from_profile ON public.profiles;
CREATE TRIGGER trg_sync_pilot_role_from_profile
AFTER INSERT OR UPDATE OF driver_id, is_active, application_status
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_pilot_role_from_profile();

-- staff_link_user sets profile.driver_id, then deletes/recreates user_roles.
-- Keep the pilot role in the resulting set even when the admin omits it.
-- The existing RPC retains its admin authorization and validations.
DO $patch_rpc$
DECLARE
  definition text;
  old_block text := E'  if \'pilot\' = any(p_roles) and p_driver_id is null then\n    raise exception \'Pilot role requires a linked driver\';\n  end if;';
  new_block text := E'  -- A linked driver always receives pilot permissions; other roles stay explicit.\n  if p_driver_id is not null and not (\'pilot\' = any(p_roles)) then\n    p_roles := array_append(p_roles, \'pilot\');\n  end if;\n\n  if \'pilot\' = any(p_roles) and p_driver_id is null then\n    raise exception \'Pilot role requires a linked driver\';\n  end if;';
BEGIN
  SELECT pg_get_functiondef('public.staff_link_user(uuid,uuid,text[],uuid,integer)'::regprocedure)
  INTO definition;

  IF strpos(definition, 'A linked driver always receives pilot permissions') > 0 THEN
    RETURN;
  END IF;

  IF strpos(definition, old_block) = 0 THEN
    RAISE EXCEPTION 'Unexpected staff_link_user implementation: refusing unsafe patch';
  END IF;

  EXECUTE replace(definition, old_block, new_block);
END
$patch_rpc$;

-- Production verification (tested in BEGIN ... ROLLBACK):
-- * Unlink a profile => pilot role removed, other roles retained.
-- * Relink same profile => pilot role restored.
-- * staff_link_user with a linked driver and empty p_roles => role 'pilot'.
-- * Existing linked accounts: 35 / 35 have pilot role.
-- * Unlinked active official T8 drivers: 12, pending future account linking.
-- * Anon and authenticated cannot directly EXECUTE the trigger function.
