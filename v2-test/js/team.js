(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const loadingPanel = document.getElementById('loadingPanel');
  const errorPanel = document.getElementById('errorPanel');
  const teamContent = document.getElementById('teamContent');
  const logoutButton = document.getElementById('teamLogoutButton');
  const previewTeamId = new URLSearchParams(window.location.search).get('preview_team');
  const previewMode = !!previewTeamId;

  const money = value => Number(value || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const date = value => value ? new Intl.DateTimeFormat('es-ES').format(new Date(`${value}T12:00:00`)) : '—';

  function showError(message) {
    loadingPanel.classList.add('is-hidden');
    teamContent.classList.add('is-hidden');
    errorPanel.textContent = message;
    errorPanel.classList.remove('is-hidden');
  }

  function configurePreviewUi(teamName) {
    if (!previewMode) return;
    const eyebrow = document.querySelector('.module-header .eyebrow');
    if (eyebrow) eyebrow.textContent = 'ADMINISTRACIÓN · VISTA TEAM PRINCIPAL';
    const back = document.querySelector('.module-header .topbar-actions a');
    if (back) {
      back.href = 'admin.html';
      back.textContent = '← Administración';
    }
    document.getElementById('teamPageTitle').textContent = `${teamName} · Vista admin`;

    if (!document.getElementById('adminPreviewBanner')) {
      const banner = document.createElement('section');
      banner.id = 'adminPreviewBanner';
      banner.style.cssText = 'margin:0 0 16px;padding:14px 16px;border:1px solid rgba(255,213,0,.28);border-radius:12px;background:rgba(255,213,0,.055);display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap';
      const copy = document.createElement('div');
      const label = document.createElement('strong');
      label.textContent = 'VISTA ADMINISTRADOR';
      label.style.cssText = 'display:block;color:var(--yellow);font-size:10px;letter-spacing:.08em';
      const text = document.createElement('span');
      text.textContent = `Estás viendo el mismo panel de Team Principal de ${teamName}. Esta vista es de comprobación.`;
      text.style.cssText = 'display:block;margin-top:4px;color:#969aa1;font-size:10px;line-height:1.5';
      copy.append(label, text);
      const returnLink = document.createElement('a');
      returnLink.href = 'admin.html';
      returnLink.className = 'secondary-button link-button';
      returnLink.textContent = 'VOLVER A ADMINISTRACIÓN';
      banner.append(copy, returnLink);
      teamContent.insertAdjacentElement('afterbegin', banner);
    }
  }

  function renderManagement(finance, roster, sponsors, account) {
    const cap = Number(finance.salary_cap_m || account.salary_cap_m || 500);
    const contracts = Number(finance.active_contract_value_m || 0);
    const available = cap - contracts;
    const usage = cap > 0 ? (contracts / cap) * 100 : 0;
    const pending = sponsors.filter(item => !item.is_completed);
    const pendingReward = pending.reduce((sum, item) => sum + Number(item.effective_reward_m || 0), 0);

    document.getElementById('capAvailable').textContent = `${money(available)} M`;
    document.getElementById('capUsage').textContent = `${usage.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
    document.getElementById('activeSponsors').textContent = pending.length;
    document.getElementById('activeSponsorsMoney').textContent = `${money(pendingReward)} M potenciales`;
    document.getElementById('rosterCount').textContent = roster.length;

    const alerts = document.getElementById('managementAlerts');
    const messages = [];

    if (available < 0) {
      messages.push({ ok: false, html: `<strong>Salary cap superado.</strong> La plantilla está ${money(Math.abs(available))} M por encima del límite.` });
    } else if (available <= 25) {
      messages.push({ ok: false, html: `<strong>Margen salarial reducido.</strong> Quedan ${money(available)} M disponibles antes de alcanzar el límite.` });
    } else {
      messages.push({ ok: true, html: `<strong>Salary cap dentro del límite.</strong> Hay ${money(available)} M disponibles.` });
    }

    if (pending.length) {
      messages.push({ ok: false, html: `<strong>${pending.length} sponsors pendientes.</strong> Pueden aportar hasta ${money(pendingReward)} M si se cumplen sus objetivos.` });
    } else {
      messages.push({ ok: true, html: '<strong>Todos los sponsors registrados están completados.</strong>' });
    }

    const charges = Number(finance.fair_play_charge_m || 0) + Number(finance.luxury_tax_m || 0);
    messages.push(charges > 0
      ? { ok: false, html: `<strong>Cargos económicos activos.</strong> Fair Play + impuesto de lujo suman ${money(charges)} M.` }
      : { ok: true, html: '<strong>Sin cargos adicionales.</strong> No hay Fair Play ni impuesto de lujo aplicados actualmente.' }
    );

    alerts.innerHTML = messages.map(item => `<div class="management-alert${item.ok ? ' ok' : ''}"><span class="management-alert-dot"></span><div>${item.html}</div></div>`).join('');
  }

  function renderRoster(items, division, targetId) {
    const target = document.getElementById(targetId);
    const rows = items.filter(item => item.division === division);
    target.innerHTML = rows.length ? '' : '<div class="empty-line">No hay pilotos activos.</div>';
    rows.forEach(item => {
      const driver = item.drivers || {};
      const el = document.createElement('div');
      el.className = 'roster-driver';
      el.innerHTML = `<div class="roster-driver-main"><span class="roster-number">${driver.race_number ?? '--'}</span><div><strong>${driver.nickname || 'Piloto'}</strong><small>${item.roster_status || 'oficial'}</small></div></div><span class="info-tag">R${item.start_round || 1} → ${item.end_round ? `R${item.end_round}` : 'ACTUAL'}</span>`;
      target.appendChild(el);
    });
  }

  function renderContracts(items) {
    const body = document.getElementById('contractsBody');
    body.innerHTML = '';
    if (!items.length) {
      body.innerHTML = '<tr><td colspan="4">No hay contratos activos.</td></tr>';
      return;
    }
    items.forEach(item => {
      const driver = item.drivers || {};
      const remaining = item.half_seasons_remaining == null ? '—' : `${item.half_seasons_remaining} medias temporadas`;
      const row = document.createElement('tr');
      row.innerHTML = `<td><strong>#${driver.race_number ?? '--'} ${driver.nickname || 'Piloto'}</strong></td><td>${money(item.driver_value_m)} M</td><td>${item.buyout_clause_m == null ? '—' : `${money(item.buyout_clause_m)} M`}</td><td>${remaining}</td>`;
      body.appendChild(row);
    });
  }

  function renderSponsors(items, division, targetId) {
    const target = document.getElementById(targetId);
    const rows = items.filter(item => item.division === division);
    target.innerHTML = rows.length ? '' : '<div class="empty-line">No hay sponsors activos.</div>';
    rows.forEach(item => {
      const el = document.createElement('div');
      el.className = 'sponsor-item';
      el.innerHTML = `<div class="sponsor-item-top"><h3>#${item.sponsor_number} · ${item.name}</h3><span class="sponsor-reward">${money(item.effective_reward_m)} M</span></div><p>${item.objective}</p><div class="sponsor-meta"><span>Dificultad ${item.difficulty}/10</span><span class="${item.is_completed ? 'sponsor-complete' : ''}">${item.is_completed ? 'COMPLETADO' : 'PENDIENTE'}</span></div>`;
      target.appendChild(el);
    });
  }

  function renderTransactions(items) {
    const body = document.getElementById('transactionsBody');
    body.innerHTML = '';
    if (!items.length) {
      body.innerHTML = '<tr><td colspan="4">No hay movimientos registrados.</td></tr>';
      return;
    }
    items.forEach(item => {
      const income = item.direction === 'income';
      const sign = income ? '+' : '−';
      const row = document.createElement('tr');
      row.innerHTML = `<td>${date(item.transaction_date)}</td><td>${item.description || 'Movimiento'}</td><td>${item.category || '—'}</td><td class="${income ? 'money-positive' : 'money-negative'}">${sign}${money(item.amount_m)} M</td>`;
      body.appendChild(row);
    });
  }

  async function load() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
      window.location.replace('index.html');
      return;
    }

    let teamId = null;
    let principal = null;

    if (previewMode) {
      const roleResponse = await client.from('user_roles')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .limit(1);
      if (roleResponse.error || !(roleResponse.data || []).length) {
        return showError('Esta vista de comprobación está disponible únicamente para administradores.');
      }
      teamId = previewTeamId;
    } else {
      const principalResponse = await client
        .from('team_principals')
        .select('team_id, season_number, is_active, teams:team_id(id, name, slug)')
        .eq('user_id', session.user.id)
        .eq('season_number', config.currentSeason)
        .eq('is_active', true)
        .maybeSingle();

      if (principalResponse.error) return showError('No se pudo comprobar tu acceso de Team Principal.');
      principal = principalResponse.data;
      if (!principal) return showError('Tu cuenta no tiene una escudería activa asignada como Team Principal en esta temporada.');
      teamId = principal.team_id;
    }

    const accountResponse = await client
      .from('team_accounts')
      .select('id, team_id, season_number, opening_balance_m, salary_cap_m, is_active, teams:team_id(name, slug)')
      .eq('team_id', teamId)
      .eq('season_number', config.currentSeason)
      .eq('is_active', true)
      .maybeSingle();

    if (accountResponse.error || !accountResponse.data) return showError('No se pudo cargar la cuenta económica de esta escudería.');
    const account = accountResponse.data;

    const [financeResponse, rosterResponse, contractsResponse, sponsorsResponse, transactionsResponse] = await Promise.all([
      client.from('team_financial_summary').select('*').eq('team_account_id', account.id).maybeSingle(),
      client.from('season_roster').select('division, roster_status, start_round, end_round, drivers:driver_id(id, nickname, race_number)').eq('team_id', teamId).eq('season_number', config.currentSeason).eq('is_active', true),
      client.from('driver_contracts').select('driver_value_m, buyout_clause_m, half_seasons_remaining, contract_start_label, contract_end_label, status, drivers:driver_id(id, nickname, race_number)').eq('team_account_id', account.id).eq('status', 'active'),
      client.from('team_sponsor_rewards').select('division, sponsor_number, name, objective, difficulty, effective_reward_m, is_completed, completed_at, is_active').eq('team_account_id', account.id).eq('is_active', true).order('division').order('sponsor_number'),
      client.from('economic_transactions').select('transaction_date, description, category, direction, amount_m, round_number, created_at').eq('account_id', account.id).order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(12)
    ]);

    const responses = [financeResponse, rosterResponse, contractsResponse, sponsorsResponse, transactionsResponse];
    const failed = responses.find(response => response.error);
    if (failed) {
      console.error('Team Principal module error:', failed.error);
      return showError('La sesión está activa, pero no se pudieron cargar todos los datos de la escudería.');
    }

    const finance = financeResponse.data || {};
    const roster = rosterResponse.data || [];
    const sponsors = sponsorsResponse.data || [];
    const teamName = account.teams?.name || principal?.teams?.name || 'Escudería';
    document.getElementById('teamPageTitle').textContent = teamName;
    document.getElementById('teamName').textContent = teamName;
    document.getElementById('teamStatus').textContent = account.is_active ? 'ACTIVA' : 'INACTIVA';
    configurePreviewUi(teamName);

    document.getElementById('currentBalance').textContent = money(finance.current_balance_m);
    document.getElementById('totalIncome').textContent = money(finance.total_income_m);
    document.getElementById('totalExpense').textContent = money(finance.total_expense_m);
    document.getElementById('seasonProfit').textContent = money(finance.season_profit_m);
    document.getElementById('contractValue').textContent = `${money(finance.active_contract_value_m)} M`;
    document.getElementById('salaryCap').textContent = `${money(finance.salary_cap_m || account.salary_cap_m)} M`;
    document.getElementById('pendingSponsors').textContent = money(finance.pending_sponsor_reward_m);
    document.getElementById('fairPlayCharge').textContent = `${money(finance.fair_play_charge_m)} M`;
    document.getElementById('luxuryTax').textContent = `${money(finance.luxury_tax_m)} M`;

    const cap = Number(finance.salary_cap_m || account.salary_cap_m || 500);
    const contracts = Number(finance.active_contract_value_m || 0);
    const percent = Math.max(0, Math.min(100, (contracts / cap) * 100));
    document.getElementById('capMeterFill').style.width = `${percent}%`;
    const available = cap - contracts;
    document.getElementById('capStatus').textContent = available >= 0 ? `${money(available)} M disponibles antes de alcanzar el límite.` : `${money(Math.abs(available))} M por encima del límite.`;

    renderManagement(finance, roster, sponsors, account);
    renderRoster(roster, 'hyperdrive', 'hyperdriveRoster');
    renderRoster(roster, 'academy', 'academyRoster');
    renderContracts(contractsResponse.data || []);
    renderSponsors(sponsors, 'hyperdrive', 'hyperdriveSponsors');
    renderSponsors(sponsors, 'academy', 'academySponsors');
    renderTransactions(transactionsResponse.data || []);

    loadingPanel.classList.add('is-hidden');
    errorPanel.classList.add('is-hidden');
    teamContent.classList.remove('is-hidden');
  }

  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    await client.auth.signOut();
    window.location.replace('index.html');
  });

  load();
})();