(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const loadingPanel = document.getElementById('loadingPanel');
  const errorPanel = document.getElementById('errorPanel');
  const staffContent = document.getElementById('staffContent');
  const logoutButton = document.getElementById('staffLogoutButton');
  const driverSearch = document.getElementById('driverSearch');
  const divisionFilter = document.getElementById('divisionFilter');
  const statusFilter = document.getElementById('statusFilter');

  let licenses = [];
  let rosterByDriver = new Map();
  let events = [];
  let licenseById = new Map();
  let sanctionsByEvent = new Map();

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const divisionName = value => value === 'academy' ? 'Academy' : value === 'hyperdrive' ? 'HyperDrive' : 'Sin asiento';
  const formatDate = value => value ? new Intl.DateTimeFormat('es-ES').format(new Date(`${value}T12:00:00`)) : '—';

  function showError(message) {
    loadingPanel.classList.add('is-hidden');
    staffContent.classList.add('is-hidden');
    errorPanel.textContent = message;
    errorPanel.classList.remove('is-hidden');
  }

  function licenseState(item) {
    const pendingRb = Number(item.rb_earned_count || 0) > Number(item.rb_served_count || 0);
    const pendingNq = Number(item.nq_earned_count || 0) > Number(item.nq_served_count || 0);
    if (pendingRb) return { key: 'pending', label: 'RB PENDIENTE', cls: 'danger' };
    if (pendingNq) return { key: 'pending', label: 'NQ PENDIENTE', cls: 'warn' };
    if (Number(item.current_points) <= 6) return { key: 'danger', label: 'EN RIESGO', cls: 'warn' };
    return { key: 'ok', label: 'OK', cls: 'ok' };
  }

  function renderSummary() {
    const activeRosterCount = [...rosterByDriver.values()].filter(Boolean).length;
    const pending = licenses.filter(item => licenseState(item).key === 'pending').length;
    document.getElementById('licenseCount').textContent = licenses.length;
    document.getElementById('rosterCount').textContent = activeRosterCount;
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('eventCount').textContent = events.length;
  }

  function getFilteredLicenses() {
    const q = driverSearch.value.trim().toLowerCase();
    const division = divisionFilter.value;
    const status = statusFilter.value;
    return licenses.filter(item => {
      const driver = item.drivers || {};
      const roster = rosterByDriver.get(item.driver_id) || null;
      const state = licenseState(item);
      const haystack = `${driver.nickname || ''} ${driver.race_number ?? ''} ${roster?.teams?.name || ''}`.toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (division !== 'all') {
        if (division === 'none' && roster) return false;
        if (division !== 'none' && roster?.division !== division) return false;
      }
      if (status !== 'all') {
        if (status === 'pending' && state.key !== 'pending') return false;
        if (status === 'danger' && Number(item.current_points) > 6) return false;
        if (status === 'ok' && state.key !== 'ok') return false;
      }
      return true;
    });
  }

  function renderLicenses() {
    const body = document.getElementById('licensesBody');
    const rows = getFilteredLicenses().sort((a,b) => Number(a.current_points) - Number(b.current_points) || String(a.drivers?.nickname || '').localeCompare(String(b.drivers?.nickname || ''), 'es'));
    body.innerHTML = '';
    if (!rows.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="8">No hay pilotos que coincidan con los filtros.</td></tr>';
    } else {
      rows.forEach(item => {
        const driver = item.drivers || {};
        const roster = rosterByDriver.get(item.driver_id) || null;
        const state = licenseState(item);
        const current = Number(item.current_points ?? 0);
        const low = current <= 6 ? ' low' : '';
        const row = document.createElement('tr');
        row.innerHTML = `<td class="driver-cell"><strong>#${esc(driver.race_number ?? '--')} ${esc(driver.nickname || 'Piloto')}</strong><small>${item.is_active ? 'Superlicencia activa' : 'Inactiva'}</small></td><td class="team-cell"><strong>${esc(roster?.teams?.name || '—')}</strong><small>${esc(divisionName(roster?.division))}</small></td><td><span class="points-pill${low}">${esc(current)} / ${esc(item.starting_points ?? 12)}</span></td><td>${esc(item.warning_count ?? 0)}</td><td>${esc(item.attendance_incident_count ?? 0)}</td><td>${esc(item.nq_earned_count ?? 0)} / ${esc(item.nq_served_count ?? 0)}</td><td>${esc(item.rb_earned_count ?? 0)} / ${esc(item.rb_served_count ?? 0)}</td><td><span class="state-pill ${state.cls}">${state.label}</span></td>`;
        body.appendChild(row);
      });
    }
    document.getElementById('resultCount').textContent = `${rows.length} de ${licenses.length} superlicencias`;
  }

  async function deleteManagedSanction(sanction, buttonGroup) {
    const moneyText = sanction.team_expense_transaction_id || sanction.beneficiary_income_transaction_id
      ? '\n• Se revertirán los movimientos económicos asociados.'
      : '';
    const pointsText = sanction.superlicense_event_id
      ? '\n• Se recalculará por completo la superlicencia del piloto.'
      : '';
    const ok = window.confirm(`¿Eliminar definitivamente la sanción ${sanction.article_code}?\n\nSe desharán todos sus efectos:${pointsText}${moneyText}\n\nLos demás movimientos históricos no se tocarán.`);
    if (!ok) return;

    [...buttonGroup.querySelectorAll('button')].forEach(button => button.disabled = true);
    const { error } = await client.rpc('staff_delete_sporting_sanction', { p_sanction_id: sanction.id });
    if (error) {
      [...buttonGroup.querySelectorAll('button')].forEach(button => button.disabled = false);
      window.alert(error.message || 'No se pudo eliminar la sanción.');
      return;
    }
    window.location.reload();
  }

  function createHistoryActions(item) {
    const cell = document.createElement('td');
    cell.className = 'history-actions-cell';
    const sanction = sanctionsByEvent.get(item.id);
    if (!sanction) {
      cell.textContent = '—';
      return cell;
    }

    const group = document.createElement('div');
    group.className = 'history-actions';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'history-action edit';
    edit.textContent = 'EDITAR';
    edit.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('hyperdrive:edit-sanction', { detail: sanction }));
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'history-action delete';
    remove.textContent = 'ELIMINAR';
    remove.addEventListener('click', () => deleteManagedSanction(sanction, group));

    group.append(edit, remove);
    cell.appendChild(group);
    return cell;
  }

  function renderEvents() {
    const body = document.getElementById('eventsBody');
    body.innerHTML = '';
    const sorted = [...events].sort((a,b) => new Date(b.event_date || b.created_at || 0).getTime() - new Date(a.event_date || a.created_at || 0).getTime()).slice(0,20);
    if (!sorted.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="7">No hay movimientos registrados.</td></tr>';
      return;
    }
    sorted.forEach(item => {
      const license = licenseById.get(item.superlicense_id) || {};
      const driver = license.drivers || {};
      const delta = Number(item.points_delta || 0);
      const deltaClass = delta < 0 ? 'delta-negative' : delta > 0 ? 'delta-positive' : '';
      const sign = delta > 0 ? '+' : '';
      const detail = item.description || item.article || 'Movimiento de superlicencia';
      const row = document.createElement('tr');
      row.innerHTML = `<td>${esc(formatDate(item.event_date))}</td><td>${item.round_number ? `R${esc(item.round_number)}` : '—'}</td><td><strong>${esc(driver.nickname || 'Piloto')}</strong></td><td>${esc(item.article || item.event_type || '—')}</td><td class="events-detail">${esc(detail)}</td><td class="${deltaClass}">${sign}${esc(delta)}</td>`;
      row.appendChild(createHistoryActions(item));
      body.appendChild(row);
    });
  }

  async function load() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) { window.location.replace('index.html'); return; }
    const rolesResponse = await client.from('user_roles').select('role').eq('user_id', session.user.id).in('role', ['staff','admin']);
    if (rolesResponse.error) return showError('No se pudieron comprobar tus permisos de Staff.');
    if (!(rolesResponse.data || []).length) return showError('Tu cuenta no tiene permisos de Staff o Administración.');

    const [licensesResponse, rosterResponse, sanctionsResponse] = await Promise.all([
      client.from('superlicenses').select('id, driver_id, season_number, starting_points, current_points, warning_count, attendance_incident_count, nq_earned_count, nq_served_count, rb_earned_count, rb_served_count, is_active, drivers:driver_id(id, nickname, race_number)').eq('season_number', config.currentSeason),
      client.from('season_roster').select('driver_id, division, roster_status, start_round, end_round, teams:team_id(name)').eq('season_number', config.currentSeason).eq('is_active', true),
      client.from('staff_sporting_sanctions').select('id,season_number,round_number,sanction_date,article_code,driver_id,team_id,beneficiary_team_id,seconds_text,points_text,description,superlicense_event_id,team_expense_transaction_id,beneficiary_income_transaction_id,created_at').eq('season_number', config.currentSeason)
    ]);
    if (licensesResponse.error || rosterResponse.error || sanctionsResponse.error) return showError('La sesión está activa, pero no se pudieron cargar los datos de competición.');

    licenses = licensesResponse.data || [];
    licenseById = new Map(licenses.map(item => [item.id, item]));
    rosterByDriver = new Map((rosterResponse.data || []).map(item => [item.driver_id, item]));
    sanctionsByEvent = new Map((sanctionsResponse.data || []).filter(item => item.superlicense_event_id).map(item => [item.superlicense_event_id, item]));

    if (licenses.length) {
      const eventsResponse = await client.from('superlicense_events').select('id, superlicense_id, round_number, event_date, event_type, points_delta, article, description, status, created_at').in('superlicense_id', licenses.map(item => item.id));
      if (eventsResponse.error) return showError('Se cargaron las superlicencias, pero no el historial de movimientos.');
      events = eventsResponse.data || [];
    }

    renderSummary();
    renderLicenses();
    renderEvents();
    loadingPanel.classList.add('is-hidden');
    errorPanel.classList.add('is-hidden');
    staffContent.classList.remove('is-hidden');
  }

  [driverSearch, divisionFilter, statusFilter].forEach(el => el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', renderLicenses));
  logoutButton.addEventListener('click', async () => { logoutButton.disabled = true; await client.auth.signOut(); window.location.replace('index.html'); });
  load();
})();