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
      card.innerHTML = `<div class="pending-account-head"><div><strong>${esc(account.email || 'Cuenta')}</strong><small>Discord: ${esc(discordName)} · Alta ${esc(formatDate(account.created_at))}</small></div><div class="pending-account-head-actions"><span class="pending-badge">PENDIENTE</span><button class="discard-request" type="button">DESCARTAR SOLICITUD</button></div></div>
      <form class="pending-config-form">
        <label class="config-field"><span>Piloto</span><select name="driver"><option value="">Sin piloto</option>${driverOptions}</select></label>
        <fieldset class="role-selector"><legend>Permisos</legend>${['pilot','team_principal','staff','admin'].map(role => `<label><input type="checkbox" name="roles" value="${role}" ${defaults.includes(role)?'checked':''}><span>${esc(roleLabel(role))}</span></label>`).join('')}</fieldset>
        <label class="config-field team-select-wrap"><span>Escudería como Team Principal</span><select name="team"><option value="">Selecciona escudería</option>${teamOptions}</select></label>
        <div class="config-actions"><p class="config-status" aria-live="polite"></p><button class="primary-button config-save" type="submit">GUARDAR CONFIGURACIÓN</button></div>
      </form>
      <button class="new-pilot-toggle" type="button">+ CREAR PILOTO NUEVO PARA ESTA CUENTA</button>
      <div class="pending-new-pilot">
        <h4>Nuevo piloto y alta en la alineación</h4>
        <div class="pending-new-pilot-grid">
          <label><span>NOMBRE / GAMERTAG EN F1</span><input name="new_nickname" autocomplete="off"></label>
          <label><span>DORSAL</span><input name="new_race_number" type="number" min="0" step="1"></label>
          <label><span>PAÍS</span><input name="new_country_code" maxlength="2" value="ES"></label>
          <label><span>REGIÓN</span><input name="new_region" placeholder="Murcia, Almería…"></label>
          <label class="full"><span>NOMBRE EN RESULTADOS SI ES DISTINTO</span><input name="new_result_alias" placeholder="Opcional"></label>
          <label><span>ESCUDERÍA</span><select name="new_team"><option value="">Selecciona escudería</option>${teams.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label>
          <label><span>DIVISIÓN</span><select name="new_division"><option value="academy">Academy</option><option value="hyperdrive">HyperDrive</option></select></label>
          <label><span>TIPO</span><select name="new_roster_status"><option value="official">Oficial</option><option value="reserve">Reserva</option></select></label>
          <label><span>DESDE RONDA</span><input name="new_start_round" type="number" min="1" step="1" placeholder="Ej. 5"></label>
          <div class="pending-new-pilot-actions"><button class="primary-button pending-create-pilot" type="button"><span>CREAR Y VINCULAR PILOTO</span></button><span class="pending-create-status"></span></div>
        </div>
      </div>`;
      target.appendChild(card);

      const form = card.querySelector('form');
      const tp = form.querySelector('input[value="team_principal"]');
      const pilot = form.querySelector('input[value="pilot"]');
      const team = form.elements.team;
      const status = form.querySelector('.config-status');
      const button = form.querySelector('.config-save');
      const discardButton = card.querySelector('.discard-request');
      const newPilotToggle = card.querySelector('.new-pilot-toggle');
      const newPilotPanel = card.querySelector('.pending-new-pilot');
      const createPilotButton = card.querySelector('.pending-create-pilot');
      const createPilotStatus = card.querySelector('.pending-create-status');
      const sync = () => { team.disabled = !tp.checked; form.elements.driver.classList.toggle('required-field', pilot.checked && !form.elements.driver.value); };
      form.querySelectorAll('input[name="roles"]').forEach(input => input.addEventListener('change',sync));
      form.elements.driver.addEventListener('change',sync);
      sync();

      newPilotToggle.addEventListener('click', () => {
        newPilotPanel.classList.toggle('open');
        newPilotToggle.textContent = newPilotPanel.classList.contains('open')
          ? '− CERRAR ALTA DE PILOTO'
          : '+ CREAR PILOTO NUEVO PARA ESTA CUENTA';
      });

      createPilotButton.addEventListener('click', async () => {
        createPilotStatus.className = 'pending-create-status';
        createPilotStatus.textContent = '';

        const nickname = String(card.querySelector('[name="new_nickname"]').value || '').trim();
        const raceNumberRaw = card.querySelector('[name="new_race_number"]').value;
        const countryCode = String(card.querySelector('[name="new_country_code"]').value || '').trim();
        const region = String(card.querySelector('[name="new_region"]').value || '').trim();
        const resultAlias = String(card.querySelector('[name="new_result_alias"]').value || '').trim();
        const rosterTeamId = card.querySelector('[name="new_team"]').value || null;
        const division = card.querySelector('[name="new_division"]').value;
        const rosterStatus = card.querySelector('[name="new_roster_status"]').value;
        const startRound = Number(card.querySelector('[name="new_start_round"]').value);
        const chosenRoles = [...form.querySelectorAll('input[name="roles"]:checked')].map(input => input.value);
        const principalTeamId = tp.checked ? (team.value || null) : null;

        if (!nickname) { createPilotStatus.classList.add('error'); createPilotStatus.textContent='Escribe el nombre/gamertag del piloto.'; return; }
        if (!rosterTeamId) { createPilotStatus.classList.add('error'); createPilotStatus.textContent='Selecciona la escudería del piloto.'; return; }
        if (!Number.isInteger(startRound) || startRound < 1) { createPilotStatus.classList.add('error'); createPilotStatus.textContent='Indica desde qué ronda entra en la alineación.'; return; }
        if (tp.checked && !principalTeamId) { createPilotStatus.classList.add('error'); createPilotStatus.textContent='Selecciona también la escudería como Team Principal.'; return; }

        createPilotButton.disabled = true;
        button.disabled = true;
        discardButton.disabled = true;
        createPilotButton.querySelector('span').textContent = 'CREANDO…';

        const { error } = await client.rpc('admin_create_driver', {
          p_nickname: nickname,
          p_race_number: raceNumberRaw ? Number(raceNumberRaw) : null,
          p_country_code: countryCode || null,
          p_region: region || null,
          p_result_alias: resultAlias || null,
          p_season_number: config.currentSeason,
          p_team_id: rosterTeamId,
          p_division: division,
          p_roster_status: rosterStatus,
          p_start_round: startRound,
          p_user_id: account.user_id,
          p_roles: chosenRoles,
          p_principal_team_id: principalTeamId
        });

        if (error) {
          console.error('New driver creation error:', error);
          createPilotStatus.classList.add('error');
          createPilotStatus.textContent = error.message || 'No se pudo crear el piloto.';
          createPilotButton.disabled = false;
          button.disabled = false;
          discardButton.disabled = false;
          createPilotButton.querySelector('span').textContent = 'CREAR Y VINCULAR PILOTO';
          return;
        }

        createPilotStatus.classList.add('success');
        createPilotStatus.textContent = 'Piloto creado: ficha, Banco +5 M, Superlicencia y alineación listas.';
        await client.rpc('admin_refresh_wagering_cycle');
        setTimeout(() => window.location.reload(), 950);
      });

      discardButton.addEventListener('click', async () => {
        const confirmed = window.confirm(`¿Descartar esta solicitud?\n\nCorreo: ${account.email || '—'}\nDiscord: ${discordName}\n\nLa cuenta dejará de aparecer entre las solicitudes pendientes. Esta acción solo se permite mientras no tenga piloto, roles ni Team Principal asignados.`);
        if (!confirmed) return;

        discardButton.disabled = true;
        button.disabled = true;
        discardButton.textContent = 'DESCARTANDO…';
        status.className = 'config-status';
        status.textContent = '';

        const { error } = await client.rpc('admin_discard_pending_account', { p_user_id: account.user_id });
        if (error) {
          status.classList.add('error');
          status.textContent = error.message || 'No se pudo descartar la solicitud.';
          discardButton.disabled = false;
          button.disabled = false;
          discardButton.textContent = 'DESCARTAR SOLICITUD';
          return;
        }

        status.classList.add('success');
        status.textContent = 'Solicitud descartada.';
        card.classList.add('discarded-card');
        setTimeout(() => window.location.reload(), 450);
      });

      form.addEventListener('submit', async event => {
        event.preventDefault();
        const chosen = [...form.querySelectorAll('input[name="roles"]:checked')].map(i => i.value);
        const driverId = form.elements.driver.value || null;
        const teamId = tp.checked ? (team.value || null) : null;
        status.className = 'config-status';
        if (!chosen.length) { status.classList.add('error'); status.textContent='Selecciona al menos un permiso.'; return; }
        if (chosen.includes('pilot') && !driverId) { status.classList.add('error'); status.textContent='El rol Piloto necesita un piloto vinculado.'; return; }
        if (chosen.includes('team_principal') && !teamId) { status.classList.add('error'); status.textContent='Selecciona una escudería para Team Principal.'; return; }
        button.disabled = true; discardButton.disabled = true; button.textContent='GUARDANDO…';
        const { error } = await client.rpc('staff_link_user',{p_user_id:account.user_id,p_driver_id:driverId,p_roles:chosen,p_team_id:teamId,p_season_number:config.currentSeason});
        if (error) { status.classList.add('error'); status.textContent=error.message || 'No se pudo guardar.'; button.disabled=false; discardButton.disabled=false; button.textContent='GUARDAR CONFIGURACIÓN'; return; }
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