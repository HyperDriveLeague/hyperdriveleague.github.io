(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const authView = document.getElementById('authView');
  const dashboardView = document.getElementById('dashboardView');
  const pilotView = document.getElementById('pilotView');
  const loginForm = document.getElementById('loginForm');
  const loginButton = document.getElementById('loginButton');
  const loginMessage = document.getElementById('loginMessage');
  const logoutButton = document.getElementById('logoutButton');
  const pilotLogoutButton = document.getElementById('pilotLogoutButton');
  const backToDashboard = document.getElementById('backToDashboard');
  const displayName = document.getElementById('displayName');
  const userEmail = document.getElementById('userEmail');
  const driverBalance = document.getElementById('driverBalance');
  const driverNumber = document.getElementById('driverNumber');
  const rolesContainer = document.getElementById('rolesContainer');
  const teamPrincipalText = document.getElementById('teamPrincipalText');
  const systemStatus = document.getElementById('systemStatus');
  const systemIndicator = document.getElementById('systemIndicator');
  const seasonBadge = document.getElementById('seasonBadge');
  const sessionLabel = document.getElementById('sessionLabel');
  const pilotCard = document.querySelector('[data-module="pilot"]');

  let activeSession = null;
  let currentRoles = [];
  let currentDriver = null;

  seasonBadge.textContent = `TEMPORADA ${config.currentSeason}`;

  const roleNames = { pilot: 'Piloto', team_principal: 'Team Principal', staff: 'Staff', admin: 'Admin' };
  const eventNames = {
    points_penalty: 'Pérdida de puntos', warning: 'Aviso', attendance_incident: 'Incidencia de asistencia',
    nq_earned: 'NQ obtenido', nq_served: 'NQ cumplido', rb_earned: 'RB obtenido', rb_served: 'RB cumplido', points_restore: 'Recuperación de puntos'
  };

  function showOnly(view) {
    authView.classList.toggle('is-hidden', view !== 'auth');
    dashboardView.classList.toggle('is-hidden', view !== 'dashboard');
    pilotView.classList.toggle('is-hidden', view !== 'pilot');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function setLoading(isLoading) {
    loginButton.disabled = isLoading;
    loginButton.querySelector('span').textContent = isLoading ? 'ACCEDIENDO…' : 'INICIAR SESIÓN';
  }

  function setLoginMessage(message = '') { loginMessage.textContent = message; }

  function resetDashboard() {
    displayName.textContent = 'Cargando…';
    userEmail.textContent = '';
    if (driverBalance) { driverBalance.textContent = 'Saldo disponible: —'; driverBalance.classList.add('is-hidden'); }
    driverNumber.textContent = '--';
    rolesContainer.innerHTML = '';
    teamPrincipalText.textContent = 'Gestión deportiva y económica de la escudería.';
    systemStatus.textContent = 'Comprobando permisos…';
    systemIndicator.textContent = 'CARGANDO';
    systemIndicator.classList.remove('ok');
    document.querySelectorAll('[data-role-card]').forEach(card => {
      card.classList.remove('has-access');
      card.classList.add('is-hidden');
      card.querySelector('.access-state').textContent = 'Sin acceso';
    });
  }

  function activateRoleCards(roles) {
    document.querySelectorAll('[data-role-card]').forEach(card => {
      const role = card.dataset.roleCard;
      const active = roles.includes(role);
      card.classList.toggle('has-access', active);
      card.classList.toggle('is-hidden', !active);
      card.querySelector('.access-state').textContent = active ? 'Acceso activo' : 'Sin acceso';
    });
  }

  async function loadDashboard(session) {
    activeSession = session;
    resetDashboard();
    showOnly('dashboard');

    const user = session.user;
    userEmail.textContent = user.email || '';
    sessionLabel.textContent = user.email ? `Sesión: ${user.email}` : 'Sesión activa';

    try {
      const [profileResponse, rolesResponse, principalResponse] = await Promise.all([
        client.from('profiles').select('id, display_name, driver_id, drivers:driver_id(id, nickname, race_number, slug, country_code, region)').eq('id', user.id).maybeSingle(),
        client.from('user_roles').select('role').eq('user_id', user.id),
        client.from('team_principals').select('team_id, season_number, is_active, teams:team_id(id, name, slug)').eq('user_id', user.id).eq('season_number', config.currentSeason).eq('is_active', true).maybeSingle()
      ]);

      if (profileResponse.error) throw profileResponse.error;
      if (rolesResponse.error) throw rolesResponse.error;
      if (principalResponse.error) throw principalResponse.error;

      const profile = profileResponse.data;
      currentRoles = (rolesResponse.data || []).map(item => item.role);
      const principal = principalResponse.data;
      currentDriver = profile?.drivers || null;

      displayName.textContent = profile?.display_name || currentDriver?.nickname || user.email || 'Usuario';
      driverNumber.textContent = currentDriver?.race_number ?? '--';

      rolesContainer.innerHTML = '';
      (currentRoles.length ? currentRoles : ['Sin roles']).forEach(role => {
        const chip = document.createElement('span');
        chip.className = 'role-chip';
        chip.textContent = roleNames[role] || role;
        rolesContainer.appendChild(chip);
      });

      if (principal?.teams?.name) teamPrincipalText.textContent = `Gestión deportiva y económica de ${principal.teams.name}.`;

      if (driverBalance && currentDriver && currentRoles.includes('pilot')) {
        const bankResponse = await client.rpc('driver_bank_dashboard');
        if (!bankResponse.error) {
          const bank = Array.isArray(bankResponse.data) ? bankResponse.data[0] : bankResponse.data;
          if (bank) {
            const balance = Number(bank.available_balance_m || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            driverBalance.textContent = `Saldo disponible: ${balance} M`;
            driverBalance.classList.remove('is-hidden');
          }
        } else {
          console.error('Error al cargar el saldo del piloto:', bankResponse.error);
        }
      }

      activateRoleCards(currentRoles);
      systemStatus.textContent = `${currentRoles.length} permisos cargados correctamente`;
      systemIndicator.textContent = 'OPERATIVO';
      systemIndicator.classList.add('ok');
    } catch (error) {
      console.error('Error al cargar el área privada:', error);
      systemStatus.textContent = 'La sesión está activa, pero no se pudieron cargar todos los permisos';
      systemIndicator.textContent = 'REVISAR';
      systemIndicator.classList.remove('ok');
    }
  }

  function formatDivision(value) {
    if (!value) return 'Sin división';
    return value.toLowerCase() === 'academy' ? 'Academy' : value.toLowerCase() === 'hyperdrive' ? 'HyperDrive' : value;
  }

  function formatDate(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
  }

  async function loadPilotModule() {
    if (!activeSession || !currentDriver || !currentRoles.includes('pilot')) return;
    showOnly('pilot');

    const nicknameEl = document.getElementById('pilotNickname');
    const numberEl = document.getElementById('pilotRaceNumber');
    const divisionEl = document.getElementById('pilotDivision');
    const teamEl = document.getElementById('pilotTeam');
    const regionEl = document.getElementById('pilotRegion');
    const currentEl = document.getElementById('licenseCurrent');
    const startingEl = document.getElementById('licenseStarting');
    const meterFill = document.getElementById('licenseMeterFill');
    const lostText = document.getElementById('licenseLostText');
    const warningsEl = document.getElementById('licenseWarnings');
    const attendanceEl = document.getElementById('licenseAttendance');
    const nqEl = document.getElementById('licenseNq');
    const rbEl = document.getElementById('licenseRb');
    const stateBadge = document.getElementById('licenseStateBadge');
    const history = document.getElementById('licenseHistory');

    nicknameEl.textContent = currentDriver.nickname || 'Piloto';
    numberEl.textContent = currentDriver.race_number ?? '--';
    regionEl.textContent = currentDriver.region || currentDriver.country_code || '—';
    divisionEl.textContent = 'Cargando…';
    teamEl.textContent = 'Cargando…';
    history.innerHTML = '<div class="history-empty">Cargando historial…</div>';

    try {
      const [rosterResponse, licenseResponse] = await Promise.all([
        client.from('season_roster').select('division, roster_status, start_round, end_round, teams:team_id(name, slug)').eq('driver_id', currentDriver.id).eq('season_number', config.currentSeason).eq('is_active', true).maybeSingle(),
        client.from('superlicenses').select('id, starting_points, current_points, warning_count, attendance_incident_count, nq_earned_count, nq_served_count, rb_earned_count, rb_served_count, points_lost_since_rb, is_active').eq('driver_id', currentDriver.id).eq('season_number', config.currentSeason).eq('is_active', true).maybeSingle()
      ]);

      if (rosterResponse.error) throw rosterResponse.error;
      if (licenseResponse.error) throw licenseResponse.error;

      const roster = rosterResponse.data;
      const license = licenseResponse.data;

      divisionEl.textContent = formatDivision(roster?.division);
      teamEl.textContent = roster?.teams?.name || 'Sin equipo';

      if (!license) {
        currentEl.textContent = '—';
        startingEl.textContent = '—';
        lostText.textContent = 'No hay superlicencia activa';
        stateBadge.textContent = 'SIN DATOS';
        stateBadge.classList.remove('ok');
        history.innerHTML = '<div class="history-empty">No hay superlicencia activa para esta temporada.</div>';
        return;
      }

      currentEl.textContent = license.current_points;
      startingEl.textContent = license.starting_points;
      const percent = Math.max(0, Math.min(100, (Number(license.current_points) / Number(license.starting_points || 12)) * 100));
      meterFill.style.width = `${percent}%`;
      const totalLost = Number(license.starting_points) - Number(license.current_points);
      lostText.textContent = totalLost === 0 ? 'Sin puntos perdidos' : `${totalLost} punto${totalLost === 1 ? '' : 's'} perdido${totalLost === 1 ? '' : 's'}`;
      warningsEl.textContent = license.warning_count ?? 0;
      attendanceEl.textContent = license.attendance_incident_count ?? 0;
      nqEl.textContent = `${license.nq_earned_count ?? 0} / ${license.nq_served_count ?? 0}`;
      rbEl.textContent = `${license.rb_earned_count ?? 0} / ${license.rb_served_count ?? 0}`;
      stateBadge.textContent = license.is_active ? 'ACTIVA' : 'INACTIVA';
      stateBadge.classList.toggle('ok', !!license.is_active);

      const eventsResponse = await client.from('superlicense_events').select('id, round_number, event_date, event_type, points_delta, article, description, status, created_at').eq('superlicense_id', license.id).order('event_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
      if (eventsResponse.error) throw eventsResponse.error;

      const events = eventsResponse.data || [];
      history.innerHTML = '';
      if (!events.length) {
        history.innerHTML = '<div class="history-empty">Todavía no hay movimientos registrados esta temporada.</div>';
      } else {
        events.forEach(event => {
          const row = document.createElement('div');
          row.className = 'history-row';
          const delta = Number(event.points_delta || 0);
          const deltaClass = delta < 0 ? 'negative' : delta > 0 ? 'positive' : '';
          const label = eventNames[event.event_type] || event.event_type || 'Evento';
          row.innerHTML = `
            <span class="history-round">${event.round_number ? `R${event.round_number}` : '—'}</span>
            <span class="history-date">${formatDate(event.event_date)}</span>
            <div class="history-description"><strong>${label}</strong><span>${event.description || event.article || 'Movimiento registrado en la superlicencia.'}</span></div>
            <span class="history-delta ${deltaClass}">${delta > 0 ? '+' : ''}${delta}</span>`;
          history.appendChild(row);
        });
      }
    } catch (error) {
      console.error('Error al cargar el módulo de piloto:', error);
      history.innerHTML = '<div class="history-empty">No se pudieron cargar todos los datos del piloto. Recarga la página e inténtalo de nuevo.</div>';
    }
  }

  async function signOut() {
    logoutButton.disabled = true;
    pilotLogoutButton.disabled = true;
    await client.auth.signOut();
    logoutButton.disabled = false;
    pilotLogoutButton.disabled = false;
    activeSession = null;
    currentRoles = [];
    currentDriver = null;
    loginForm.reset();
    resetDashboard();
    showOnly('auth');
  }

  pilotCard.addEventListener('click', () => { if (pilotCard.classList.contains('has-access')) loadPilotModule(); });
  pilotCard.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && pilotCard.classList.contains('has-access')) {
      event.preventDefault();
      loadPilotModule();
    }
  });
  backToDashboard.addEventListener('click', () => showOnly('dashboard'));
  logoutButton.addEventListener('click', signOut);
  pilotLogoutButton.addEventListener('click', signOut);

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    setLoginMessage('');
    setLoading(true);
    const email = loginForm.email.value.trim();
    const password = loginForm.password.value;
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setLoginMessage('Correo o contraseña incorrectos.'); return; }
    if (data.session) await loadDashboard(data.session);
  });

  client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      activeSession = null;
      currentRoles = [];
      currentDriver = null;
      resetDashboard();
      showOnly('auth');
      return;
    }
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') window.setTimeout(() => loadDashboard(session), 0);
  });

  (async () => {
    const { data: { session } } = await client.auth.getSession();
    if (session) await loadDashboard(session); else showOnly('auth');
  })();
})();