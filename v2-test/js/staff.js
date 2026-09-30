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
  let staffNavReady = false;

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
    const badge = document.getElementById('staffHubPending');
    if (badge) badge.textContent = pending ? `${pending} pendiente${pending === 1 ? '' : 's'}` : 'Sin pendientes';
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
      showStaffSection('sanctions', true);
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('hyperdrive:edit-sanction', { detail: sanction }));
      }, 0);
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

  function installStaffNavigationStyles() {
    if (document.getElementById('staffHubStyles')) return;
    const style = document.createElement('style');
    style.id = 'staffHubStyles';
    style.textContent = `
      .staff-hub{margin:26px 0 10px}.staff-hub-heading{margin-bottom:15px}.staff-hub-heading h2{margin:5px 0 0;font-size:28px}.staff-hub-heading p{margin:8px 0 0;color:#7f838a;font-size:12px;line-height:1.55;max-width:720px}.staff-hub-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.staff-hub-card{appearance:none;text-align:left;border:1px solid rgba(255,255,255,.09);background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.018));border-radius:17px;padding:22px;color:#fff;cursor:pointer;min-height:210px;display:flex;flex-direction:column;transition:transform .18s ease,border-color .18s ease,background .18s ease}.staff-hub-card:hover{transform:translateY(-2px);border-color:rgba(255,213,0,.4);background:linear-gradient(180deg,rgba(255,213,0,.055),rgba(255,255,255,.018))}.staff-hub-icon{width:48px;height:48px;border-radius:12px;background:var(--yellow);color:#050505;display:grid;place-items:center;font-weight:950;font-size:20px;margin-bottom:22px}.staff-hub-card .hub-kicker{font-size:9px;font-weight:900;letter-spacing:.1em;color:var(--yellow);margin-bottom:6px}.staff-hub-card h3{font-size:21px;margin:0 0 8px}.staff-hub-card p{font-size:11px;line-height:1.55;color:#858990;margin:0 0 18px}.staff-hub-footer{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:10px;font-weight:900}.staff-hub-footer span:first-child{color:#c7c9ce}.staff-hub-badge{padding:5px 8px;border-radius:999px;border:1px solid rgba(255,213,0,.18);color:var(--yellow);background:rgba(255,213,0,.05);white-space:nowrap}.staff-section-bar{margin:24px 0 18px;padding:14px 16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);border-radius:13px;display:flex;align-items:center;justify-content:space-between;gap:18px}.staff-section-copy span{display:block;font-size:9px;letter-spacing:.1em;font-weight:900;color:var(--yellow);margin-bottom:4px}.staff-section-copy strong{display:block;font-size:18px}.staff-section-copy small{display:block;color:#777b82;font-size:10px;margin-top:4px;line-height:1.45}.staff-back-button{border:1px solid rgba(255,255,255,.1);background:#111318;color:#fff;border-radius:9px;padding:10px 13px;font:inherit;font-size:10px;font-weight:900;cursor:pointer;white-space:nowrap}.staff-back-button:hover{border-color:rgba(255,213,0,.4);color:var(--yellow)}.staff-nav-hidden{display:none!important}@media(max-width:860px){.staff-hub-grid{grid-template-columns:1fr}.staff-hub-card{min-height:170px}.staff-section-bar{align-items:flex-start;flex-direction:column}.staff-back-button{width:100%}}`;
    document.head.appendChild(style);
  }

  function getStaffRegions() {
    const summaryGrid = document.querySelector('.staff-summary-grid');
    const summaryHeading = summaryGrid?.previousElementSibling || null;
    const operations = document.getElementById('staffOperations');
    const operationHeading = operations?.querySelector(':scope > .module-section-heading') || null;
    const operationTabs = operations?.querySelector('.operations-tabs') || null;
    const filters = document.querySelector('.filters-panel');
    const pilotsHeading = filters?.previousElementSibling || null;
    const pilotsTable = filters?.nextElementSibling || null;
    const eventsBody = document.getElementById('eventsBody');
    const historyPanel = eventsBody?.closest('.staff-panel') || null;
    const historyHeading = historyPanel?.previousElementSibling || null;
    return { summaryGrid, summaryHeading, operations, operationHeading, operationTabs, filters, pilotsHeading, pilotsTable, historyPanel, historyHeading };
  }

  function setVisible(element, visible) {
    if (!element) return;
    element.classList.toggle('staff-nav-hidden', !visible);
  }

  function activateOperationTab(key, visibleKeys = []) {
    const operations = document.getElementById('staffOperations');
    if (!operations) return;
    const tabs = [...operations.querySelectorAll('[data-operation-tab]')];
    tabs.forEach(button => {
      button.style.display = visibleKeys.length && !visibleKeys.includes(button.dataset.operationTab) ? 'none' : '';
    });
    const target = tabs.find(button => button.dataset.operationTab === key);
    if (target) target.click();
  }

  function sectionMeta(section) {
    if (section === 'points') return {
      title: 'Superlicencias y puntos',
      desc: 'Puntos actuales, NQ/RB pendientes, estado de cada piloto e histórico de superlicencia.'
    };
    if (section === 'sanctions') return {
      title: 'Sanciones deportivas',
      desc: 'Aplicar artículos del reglamento, escudería beneficiada y edición o eliminación de sanciones.'
    };
    if (section === 'economy') return {
      title: 'Economía y movimientos',
      desc: 'Multas, ingresos/gastos manuales e histórico económico editable.'
    };
    return { title: 'Race Control', desc: '' };
  }

  function showStaffSection(section = 'home', pushHash = false) {
    if (!staffNavReady) return;
    const regions = getStaffRegions();
    const menu = document.getElementById('staffHub');
    const bar = document.getElementById('staffSectionBar');
    const barTitle = document.getElementById('staffSectionTitle');
    const barDesc = document.getElementById('staffSectionDesc');
    const home = section === 'home';

    setVisible(menu, home);
    setVisible(bar, !home);
    setVisible(regions.summaryHeading, section === 'points');
    setVisible(regions.summaryGrid, section === 'points');
    setVisible(regions.pilotsHeading, section === 'points');
    setVisible(regions.filters, section === 'points');
    setVisible(regions.pilotsTable, section === 'points');
    setVisible(regions.historyHeading, section === 'points' || section === 'sanctions');
    setVisible(regions.historyPanel, section === 'points' || section === 'sanctions');
    setVisible(regions.operations, !home);

    if (!home) {
      const meta = sectionMeta(section);
      if (barTitle) barTitle.textContent = meta.title;
      if (barDesc) barDesc.textContent = meta.desc;
      setVisible(regions.operationHeading, false);
      if (section === 'points') {
        setVisible(regions.operationTabs, false);
        activateOperationTab('bans', ['bans']);
      } else if (section === 'sanctions') {
        setVisible(regions.operationTabs, false);
        activateOperationTab('sanctions', ['sanctions']);
      } else if (section === 'economy') {
        setVisible(regions.operationTabs, true);
        activateOperationTab('fines', ['fines', 'manual', 'economy-history']);
      }
    }

    if (home) {
      setVisible(regions.operationHeading, false);
      setVisible(regions.operationTabs, false);
    }

    if (pushHash) {
      const next = home ? window.location.pathname + window.location.search : `#${section}`;
      history.pushState(null, '', next);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function buildStaffHub() {
    if (document.getElementById('staffHub')) return;
    installStaffNavigationStyles();
    const hero = staffContent.querySelector('.staff-hero');
    if (!hero) return;

    const menu = document.createElement('section');
    menu.id = 'staffHub';
    menu.className = 'staff-hub';
    menu.innerHTML = `
      <div class="staff-hub-heading">
        <span class="eyebrow">SECCIONES</span>
        <h2>¿Qué quieres gestionar?</h2>
        <p>Race Control está separado por áreas para que no tengas sanciones, superlicencias y economía mezcladas en la misma pantalla.</p>
      </div>
      <div class="staff-hub-grid">
        <button class="staff-hub-card" type="button" data-staff-section="points">
          <span class="staff-hub-icon">12</span>
          <span class="hub-kicker">SUPERLICENCIA</span>
          <h3>Puntos y superlicencias</h3>
          <p>Consulta puntos, avisos, NQ/RB pendientes y el histórico de movimientos de cada piloto.</p>
          <span class="staff-hub-footer"><span>ABRIR SECCIÓN →</span><span id="staffHubPending" class="staff-hub-badge">Comprobando…</span></span>
        </button>
        <button class="staff-hub-card" type="button" data-staff-section="sanctions">
          <span class="staff-hub-icon">S</span>
          <span class="hub-kicker">REGLAMENTO</span>
          <h3>Sanciones deportivas</h3>
          <p>Aplica artículos, asigna la escudería perjudicada o beneficiada y corrige sanciones si hay un error.</p>
          <span class="staff-hub-footer"><span>ABRIR SECCIÓN →</span><span class="staff-hub-badge">63 artículos</span></span>
        </button>
        <button class="staff-hub-card" type="button" data-staff-section="economy">
          <span class="staff-hub-icon">€</span>
          <span class="hub-kicker">ECONOMÍA</span>
          <h3>Movimientos y multas</h3>
          <p>Gestiona multas, ingresos/gastos manuales y el histórico económico creado desde Race Control.</p>
          <span class="staff-hub-footer"><span>ABRIR SECCIÓN →</span><span class="staff-hub-badge">BANCO</span></span>
        </button>
      </div>`;

    const bar = document.createElement('section');
    bar.id = 'staffSectionBar';
    bar.className = 'staff-section-bar staff-nav-hidden';
    bar.innerHTML = `<div class="staff-section-copy"><span>RACE CONTROL</span><strong id="staffSectionTitle">Sección</strong><small id="staffSectionDesc"></small></div><button id="staffBackButton" class="staff-back-button" type="button">← VOLVER A STAFF</button>`;

    hero.insertAdjacentElement('afterend', bar);
    hero.insertAdjacentElement('afterend', menu);

    menu.querySelectorAll('[data-staff-section]').forEach(button => {
      button.addEventListener('click', () => showStaffSection(button.dataset.staffSection, true));
    });
    document.getElementById('staffBackButton')?.addEventListener('click', () => showStaffSection('home', true));
    staffNavReady = true;

    const hashSection = window.location.hash.replace('#', '');
    showStaffSection(['points', 'sanctions', 'economy'].includes(hashSection) ? hashSection : 'home', false);
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
    buildStaffHub();
    renderSummary();
  }

  [driverSearch, divisionFilter, statusFilter].forEach(el => el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', renderLicenses));
  logoutButton.addEventListener('click', async () => { logoutButton.disabled = true; await client.auth.signOut(); window.location.replace('index.html'); });
  window.addEventListener('hashchange', () => {
    if (!staffNavReady) return;
    const section = window.location.hash.replace('#', '');
    showStaffSection(['points', 'sanctions', 'economy'].includes(section) ? section : 'home', false);
  });
  load();
})();