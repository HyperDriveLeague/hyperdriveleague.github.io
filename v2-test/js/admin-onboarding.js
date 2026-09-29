(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const adminContent = document.getElementById('adminContent');
  const target = document.getElementById('pendingAccounts');
  if (!adminContent || !target) return;

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const roleLabel = role => ({pilot:'Piloto',team_principal:'Team Principal',staff:'Staff',admin:'Admin'}[role] || role);
  const formatDate = value => value ? new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value)) : '—';

  async function init() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) return;

    const [adminCheck, pendingRes, driversRes, teamsRes, profilesRes, principalsRes, rolesRes] = await Promise.all([
      client.from('user_roles').select('role').eq('user_id', session.user.id).eq('role','admin').maybeSingle(),
      client.rpc('staff_pending_accounts'),
      client.from('drivers').select('id,nickname,race_number,is_active').eq('is_active',true).order('nickname'),
      client.from('teams').select('id,name').order('name'),
      client.from('profiles').select('id,driver_id'),
      client.from('team_principals').select('user_id,team_id').eq('season_number',config.currentSeason).eq('is_active',true),
      client.from('user_roles').select('user_id,role')
    ]);

    if (!adminCheck.data || [pendingRes,driversRes,teamsRes,profilesRes,principalsRes,rolesRes].some(r => r.error)) return;

    const pending = pendingRes.data || [];
    const drivers = driversRes.data || [];
    const teams = teamsRes.data || [];
    const profiles = profilesRes.data || [];
    const principals = principalsRes.data || [];
    const allRoles = rolesRes.data || [];

    if (!pending.length) {
      target.innerHTML = '<div class="empty-line">No hay cuentas pendientes de configurar.</div>';
      return;
    }

    target.innerHTML = '';
    pending.forEach(account => {
      const existingRoles = allRoles.filter(r => r.user_id === account.user_id).map(r => r.role);
      const defaults = existingRoles.length ? existingRoles : ['pilot'];
      const usedDriverIds = new Set(profiles.filter(p => p.id !== account.user_id && p.driver_id).map(p => p.driver_id));
      const occupiedTeamIds = new Set(principals.filter(p => p.user_id !== account.user_id).map(p => p.team_id));
      const driverOptions = drivers.filter(d => !usedDriverIds.has(d.id)).map(d => `<option value="${esc(d.id)}">#${esc(d.race_number ?? '--')} · ${esc(d.nickname)}</option>`).join('');
      const teamOptions = teams.filter(t => !occupiedTeamIds.has(t.id)).map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
      const discordName = account.discord_username || account.display_name || 'No indicado';

      const card = document.createElement('div');
      card.className = 'pending-account pending-config-card';
      card.innerHTML = `<div class="pending-account-head"><div><strong>${esc(account.email || 'Cuenta')}</strong><small>Discord: ${esc(discordName)} · Alta ${esc(formatDate(account.created_at))}</small></div><span class="pending-badge">PENDIENTE</span></div>
      <form class="pending-config-form">
        <label class="config-field"><span>Piloto</span><select name="driver"><option value="">Sin piloto</option>${driverOptions}</select></label>
        <fieldset class="role-selector"><legend>Permisos</legend>${['pilot','team_principal','staff','admin'].map(role => `<label><input type="checkbox" name="roles" value="${role}" ${defaults.includes(role)?'checked':''}><span>${esc(roleLabel(role))}</span></label>`).join('')}</fieldset>
        <label class="config-field team-select-wrap"><span>Escudería como Team Principal</span><select name="team"><option value="">Selecciona escudería</option>${teamOptions}</select></label>
        <div class="config-actions"><p class="config-status" aria-live="polite"></p><button class="primary-button config-save" type="submit">GUARDAR CONFIGURACIÓN</button></div>
      </form>`;
      target.appendChild(card);

      const form = card.querySelector('form');
      const tp = form.querySelector('input[value="team_principal"]');
      const pilot = form.querySelector('input[value="pilot"]');
      const team = form.elements.team;
      const status = form.querySelector('.config-status');
      const button = form.querySelector('.config-save');
      const sync = () => { team.disabled = !tp.checked; form.elements.driver.classList.toggle('required-field', pilot.checked && !form.elements.driver.value); };
      form.querySelectorAll('input[name="roles"]').forEach(input => input.addEventListener('change',sync));
      form.elements.driver.addEventListener('change',sync);
      sync();

      form.addEventListener('submit', async event => {
        event.preventDefault();
        const chosen = [...form.querySelectorAll('input[name="roles"]:checked')].map(i => i.value);
        const driverId = form.elements.driver.value || null;
        const teamId = tp.checked ? (team.value || null) : null;
        status.className = 'config-status';
        if (!chosen.length) { status.classList.add('error'); status.textContent='Selecciona al menos un permiso.'; return; }
        if (chosen.includes('pilot') && !driverId) { status.classList.add('error'); status.textContent='El rol Piloto necesita un piloto vinculado.'; return; }
        if (chosen.includes('team_principal') && !teamId) { status.classList.add('error'); status.textContent='Selecciona una escudería para Team Principal.'; return; }
        button.disabled = true; button.textContent='GUARDANDO…';
        const { error } = await client.rpc('staff_link_user',{p_user_id:account.user_id,p_driver_id:driverId,p_roles:chosen,p_team_id:teamId,p_season_number:config.currentSeason});
        if (error) { status.classList.add('error'); status.textContent=error.message || 'No se pudo guardar.'; button.disabled=false; button.textContent='GUARDAR CONFIGURACIÓN'; return; }
        status.classList.add('success'); status.textContent='Cuenta configurada correctamente.';
        setTimeout(() => window.location.reload(),700);
      });
    });
  }

  if (!adminContent.classList.contains('is-hidden')) init();
  else {
    const observer = new MutationObserver(() => {
      if (!adminContent.classList.contains('is-hidden')) { observer.disconnect(); init(); }
    });
    observer.observe(adminContent,{attributes:true,attributeFilter:['class']});
  }
})();