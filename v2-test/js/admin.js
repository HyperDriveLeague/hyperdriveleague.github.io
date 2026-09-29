(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const loadingPanel = document.getElementById('loadingPanel');
  const errorPanel = document.getElementById('errorPanel');
  const adminContent = document.getElementById('adminContent');
  const logoutButton = document.getElementById('adminLogoutButton');
  const accountSearch = document.getElementById('accountSearch');

  let profiles = [];
  let roles = [];
  let principals = [];
  let pendingAccounts = [];

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const roleLabel = role => ({ pilot:'Piloto', team_principal:'Team Principal', staff:'Staff', admin:'Admin' }[role] || role);
  const formatDate = value => value ? new Intl.DateTimeFormat('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' }).format(new Date(value)) : '—';

  function showError(message) {
    loadingPanel.classList.add('is-hidden');
    adminContent.classList.add('is-hidden');
    errorPanel.textContent = message;
    errorPanel.classList.remove('is-hidden');
  }

  function rolesFor(userId) {
    return roles.filter(item => item.user_id === userId).map(item => item.role);
  }

  function principalFor(userId) {
    return principals.find(item => item.user_id === userId) || null;
  }

  function renderSummary() {
    document.getElementById('profileCount').textContent = profiles.length;
    document.getElementById('linkedCount').textContent = profiles.filter(item => !!item.driver_id).length;
    document.getElementById('pendingCount').textContent = pendingAccounts.length;
    document.getElementById('principalCount').textContent = principals.length;
    document.getElementById('roleCount').textContent = roles.length;
  }

  function renderAccounts() {
    const body = document.getElementById('accountsBody');
    const q = accountSearch.value.trim().toLowerCase();
    const rows = profiles.filter(profile => {
      const userRoles = rolesFor(profile.id).map(roleLabel).join(' ');
      const principal = principalFor(profile.id);
      const haystack = `${profile.display_name || ''} ${profile.drivers?.nickname || ''} ${profile.drivers?.race_number ?? ''} ${principal?.teams?.name || ''} ${userRoles}`.toLowerCase();
      return !q || haystack.includes(q);
    });

    body.innerHTML = '';
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="5">No hay cuentas que coincidan con la búsqueda.</td></tr>';
      return;
    }

    rows.forEach(profile => {
      const driver = profile.drivers || null;
      const userRoles = rolesFor(profile.id);
      const principal = principalFor(profile.id);
      const chips = userRoles.length
        ? userRoles.map(role => `<span class="admin-role-chip">${esc(roleLabel(role))}</span>`).join('')
        : '<span class="admin-role-chip">Sin roles</span>';
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="profile-cell"><strong>${esc(profile.display_name || 'Sin nombre')}</strong><small>${esc(profile.id)}</small></td>
        <td class="pilot-cell">${driver ? `<strong>#${esc(driver.race_number ?? '--')} ${esc(driver.nickname || 'Piloto')}</strong><small>Vinculado</small>` : '<strong>—</strong><small>Sin piloto</small>'}</td>
        <td><div class="role-chips">${chips}</div></td>
        <td>${principal?.teams?.name ? esc(principal.teams.name) : '—'}</td>
        <td><span class="admin-state ${profile.is_active ? 'ok' : 'off'}">${profile.is_active ? 'ACTIVO' : 'INACTIVO'}</span></td>`;
      body.appendChild(row);
    });
  }

  function renderPending() {
    const target = document.getElementById('pendingAccounts');
    target.innerHTML = '';
    if (!pendingAccounts.length) {
      target.innerHTML = '<div class="empty-line">No hay cuentas sin piloto vinculado.</div>';
      return;
    }

    pendingAccounts.forEach(item => {
      const el = document.createElement('div');
      el.className = 'pending-account';
      el.innerHTML = `<div><strong>${esc(item.email || item.display_name || 'Cuenta')}</strong><small>${esc(item.display_name || 'Sin nombre')} · Alta ${esc(formatDate(item.created_at))}</small></div><span class="pending-badge">SIN PILOTO</span>`;
      target.appendChild(el);
    });
  }

  function renderRoleDistribution() {
    const target = document.getElementById('roleDistribution');
    const order = ['pilot','team_principal','staff','admin'];
    target.innerHTML = '';
    order.forEach(role => {
      const count = roles.filter(item => item.role === role).length;
      const el = document.createElement('article');
      el.className = 'role-card';
      el.innerHTML = `<span>${esc(roleLabel(role))}</span><strong>${count}</strong><small>cuenta${count === 1 ? '' : 's'} con este permiso</small>`;
      target.appendChild(el);
    });
  }

  async function load() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
      window.location.replace('index.html');
      return;
    }

    const adminRoleResponse = await client.from('user_roles').select('role').eq('user_id', session.user.id).eq('role', 'admin').maybeSingle();
    if (adminRoleResponse.error) return showError('No se pudieron comprobar tus permisos de Administración.');
    if (!adminRoleResponse.data) return showError('Tu cuenta no tiene permisos de Administración.');

    const [profilesResponse, rolesResponse, principalsResponse, pendingResponse] = await Promise.all([
      client.from('profiles').select('id, driver_id, display_name, is_active, created_at, drivers:driver_id(id, nickname, race_number)').order('created_at', { ascending:true }),
      client.from('user_roles').select('user_id, role, created_at').order('created_at', { ascending:true }),
      client.from('team_principals').select('user_id, team_id, season_number, is_active, teams:team_id(name)').eq('season_number', config.currentSeason).eq('is_active', true),
      client.rpc('staff_pending_accounts')
    ]);

    const failed = [profilesResponse, rolesResponse, principalsResponse, pendingResponse].find(response => response.error);
    if (failed) {
      console.error('Admin module error:', failed.error);
      return showError('La sesión está activa, pero no se pudieron cargar todos los datos de Administración.');
    }

    profiles = profilesResponse.data || [];
    roles = rolesResponse.data || [];
    principals = principalsResponse.data || [];
    pendingAccounts = pendingResponse.data || [];

    renderSummary();
    renderAccounts();
    renderPending();
    renderRoleDistribution();

    loadingPanel.classList.add('is-hidden');
    errorPanel.classList.add('is-hidden');
    adminContent.classList.remove('is-hidden');
  }

  accountSearch.addEventListener('input', renderAccounts);
  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    await client.auth.signOut();
    window.location.replace('index.html');
  });

  load();
})();
