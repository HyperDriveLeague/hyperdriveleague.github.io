(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const client = window.supabase.createClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  const authView = document.getElementById('authView');
  const dashboardView = document.getElementById('dashboardView');
  const loginForm = document.getElementById('loginForm');
  const loginButton = document.getElementById('loginButton');
  const loginMessage = document.getElementById('loginMessage');
  const logoutButton = document.getElementById('logoutButton');
  const displayName = document.getElementById('displayName');
  const userEmail = document.getElementById('userEmail');
  const driverNumber = document.getElementById('driverNumber');
  const rolesContainer = document.getElementById('rolesContainer');
  const teamPrincipalText = document.getElementById('teamPrincipalText');
  const systemStatus = document.getElementById('systemStatus');
  const systemIndicator = document.getElementById('systemIndicator');
  const seasonBadge = document.getElementById('seasonBadge');
  const sessionLabel = document.getElementById('sessionLabel');

  seasonBadge.textContent = `TEMPORADA ${config.currentSeason}`;

  const roleNames = {
    pilot: 'Piloto',
    team_principal: 'Team Principal',
    staff: 'Staff',
    admin: 'Admin'
  };

  function setView(isAuthenticated) {
    authView.classList.toggle('is-hidden', isAuthenticated);
    dashboardView.classList.toggle('is-hidden', !isAuthenticated);
  }

  function setLoading(isLoading) {
    loginButton.disabled = isLoading;
    loginButton.querySelector('span').textContent = isLoading ? 'ACCEDIENDO…' : 'INICIAR SESIÓN';
  }

  function setLoginMessage(message = '') {
    loginMessage.textContent = message;
  }

  function resetDashboard() {
    displayName.textContent = 'Cargando…';
    userEmail.textContent = '';
    driverNumber.textContent = '--';
    rolesContainer.innerHTML = '';
    teamPrincipalText.textContent = 'Gestión deportiva y económica de la escudería.';
    systemStatus.textContent = 'Comprobando permisos…';
    systemIndicator.textContent = 'CARGANDO';
    systemIndicator.classList.remove('ok');
    document.querySelectorAll('[data-role-card]').forEach(card => {
      card.classList.remove('has-access');
      card.querySelector('.access-state').textContent = 'Sin acceso';
    });
  }

  function activateRoleCards(roles) {
    document.querySelectorAll('[data-role-card]').forEach(card => {
      const role = card.dataset.roleCard;
      const active = roles.includes(role);
      card.classList.toggle('has-access', active);
      card.querySelector('.access-state').textContent = active ? 'Acceso activo' : 'Sin acceso';
    });
  }

  async function loadDashboard(session) {
    resetDashboard();
    setView(true);

    const user = session.user;
    userEmail.textContent = user.email || '';
    sessionLabel.textContent = user.email ? `Sesión: ${user.email}` : 'Sesión activa';

    try {
      const [profileResponse, rolesResponse, principalResponse] = await Promise.all([
        client
          .from('profiles')
          .select('id, display_name, driver_id, drivers:driver_id(id, nickname, race_number, slug)')
          .eq('id', user.id)
          .maybeSingle(),
        client
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id),
        client
          .from('team_principals')
          .select('team_id, season_number, is_active, teams:team_id(id, name, slug)')
          .eq('user_id', user.id)
          .eq('season_number', config.currentSeason)
          .eq('is_active', true)
          .maybeSingle()
      ]);

      if (profileResponse.error) throw profileResponse.error;
      if (rolesResponse.error) throw rolesResponse.error;
      if (principalResponse.error) throw principalResponse.error;

      const profile = profileResponse.data;
      const roles = (rolesResponse.data || []).map(item => item.role);
      const principal = principalResponse.data;
      const driver = profile?.drivers || null;

      displayName.textContent = profile?.display_name || driver?.nickname || user.email || 'Usuario';
      driverNumber.textContent = driver?.race_number ?? '--';

      rolesContainer.innerHTML = '';
      roles.forEach(role => {
        const chip = document.createElement('span');
        chip.className = 'role-chip';
        chip.textContent = roleNames[role] || role;
        rolesContainer.appendChild(chip);
      });

      if (!roles.length) {
        const chip = document.createElement('span');
        chip.className = 'role-chip';
        chip.textContent = 'Sin roles';
        rolesContainer.appendChild(chip);
      }

      if (principal?.teams?.name) {
        teamPrincipalText.textContent = `Gestión deportiva y económica de ${principal.teams.name}.`;
      }

      activateRoleCards(roles);
      systemStatus.textContent = `${roles.length} permisos cargados correctamente`;
      systemIndicator.textContent = 'OPERATIVO';
      systemIndicator.classList.add('ok');
    } catch (error) {
      console.error('Error al cargar el área privada:', error);
      systemStatus.textContent = 'La sesión está activa, pero no se pudieron cargar todos los permisos';
      systemIndicator.textContent = 'REVISAR';
      systemIndicator.classList.remove('ok');
    }
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    setLoginMessage('');
    setLoading(true);

    const email = loginForm.email.value.trim();
    const password = loginForm.password.value;

    const { data, error } = await client.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setLoginMessage('Correo o contraseña incorrectos.');
      return;
    }

    if (data.session) {
      await loadDashboard(data.session);
    }
  });

  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    await client.auth.signOut();
    logoutButton.disabled = false;
    loginForm.reset();
    resetDashboard();
    setView(false);
  });

  client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      resetDashboard();
      setView(false);
      return;
    }

    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      window.setTimeout(() => loadDashboard(session), 0);
    }
  });

  (async () => {
    const { data: { session } } = await client.auth.getSession();
    if (session) {
      await loadDashboard(session);
    } else {
      setView(false);
    }
  })();
})();
