(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const $ = id => document.getElementById(id);
  const money = value => Number(value || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dateTime = value => value ? new Intl.DateTimeFormat('es-ES', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(value)) : '—';
  const statusLabel = value => ({ pending:'PENDIENTE', approved:'APROBADA', rejected:'RECHAZADA', cancelled:'CANCELADA' }[value] || String(value || '').toUpperCase());

  function showError(message) {
    $('loadingPanel').classList.add('is-hidden');
    $('bankContent').classList.add('is-hidden');
    $('errorPanel').textContent = message;
    $('errorPanel').classList.remove('is-hidden');
  }

  function setMessage(message = '', type = '') {
    $('transferMessage').textContent = message;
    $('transferMessage').className = 'bank-form-message' + (type ? ' ' + type : '');
  }

  function renderTransfers(items) {
    const target = $('transferHistory');
    target.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'bank-empty';
      empty.textContent = 'No hay solicitudes de transferencia.';
      target.appendChild(empty);
      return;
    }
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'bank-transfer-row';

      const top = document.createElement('div');
      top.className = 'bank-transfer-top';
      const title = document.createElement('strong');
      title.textContent = item.direction === 'driver_to_team'
        ? 'Tú → ' + (item.team_name || 'Escudería')
        : (item.team_name || 'Escudería') + ' → Tú';
      const state = document.createElement('span');
      state.className = 'status-' + item.status;
      state.textContent = statusLabel(item.status);
      top.append(title, state);

      const meta = document.createElement('p');
      meta.textContent = money(item.amount_m) + ' M · ' + dateTime(item.requested_at)
        + (item.note ? ' · ' + item.note : '')
        + (item.review_note ? ' · Admin: ' + item.review_note : '');
      row.append(top, meta);
      target.appendChild(row);
    });
  }

  function renderWagerDetail(item) {
    const detail = item.wager_detail;
    if (!detail) return null;

    const wrap = document.createElement('div');
    wrap.className = 'bank-wager-detail';

    const event = document.createElement('div');
    event.className = 'bank-wager-event';
    const division = detail.division === 'academy' ? 'Academy' : detail.division === 'hyperdrive' ? 'HyperDrive' : '';
    event.textContent = [
      detail.season_number ? 'T' + detail.season_number : '',
      detail.round_number ? 'R' + detail.round_number : '',
      detail.grand_prix || '',
      division
    ].filter(Boolean).join(' · ');
    wrap.appendChild(event);

    if (detail.kind === 'hyperbet') {
      const legs = Array.isArray(detail.legs) ? detail.legs : [];
      legs.forEach(leg => {
        const line = document.createElement('div');
        line.className = 'bank-wager-line';

        const market = document.createElement('strong');
        market.textContent = leg.market || 'Mercado';

        const selection = document.createElement('span');
        selection.textContent = ' · ' + (leg.selection || 'Selección');

        const odds = document.createElement('span');
        odds.className = 'bank-wager-odds';
        odds.textContent = ' @' + Number(leg.odds || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        line.append(market, selection, odds);
        wrap.appendChild(line);
      });

      if (detail.bet_type === 'combo') {
        const total = document.createElement('div');
        total.className = 'bank-wager-total';
        total.textContent = 'Cuota combinada: @' + Number(detail.combined_odds || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        wrap.appendChild(total);
      }
    }

    if (detail.kind === 'hyperloto') {
      const special = document.createElement('div');
      special.className = 'bank-wager-line';
      special.textContent = 'Pole: ' + (detail.pole || '—') + ' · Vuelta rápida: ' + (detail.fastest_lap || '—');
      wrap.appendChild(special);

      const top10 = Array.isArray(detail.top10) ? detail.top10 : [];
      const grid = document.createElement('div');
      grid.className = 'bank-loto-grid';
      top10.forEach(pick => {
        const chip = document.createElement('span');
        chip.textContent = 'P' + pick.position + ' ' + (pick.driver || '—');
        grid.appendChild(chip);
      });
      wrap.appendChild(grid);

      const noOdds = document.createElement('div');
      noOdds.className = 'bank-wager-total';
      noOdds.textContent = 'Cuota: no aplica · boleto de quiniela HyperLoto';
      wrap.appendChild(noOdds);
    }

    return wrap;
  }

  function renderHistory(items) {
    const body = $('bankHistoryBody');
    body.innerHTML = '';
    if (!items.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.textContent = 'No hay movimientos registrados.';
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }

    items.forEach(item => {
      const tr = document.createElement('tr');

      const dateCell = document.createElement('td');
      dateCell.textContent = dateTime(item.transaction_at);
      tr.appendChild(dateCell);

      const concept = document.createElement('td');
      concept.className = 'bank-concept-cell';
      const title = document.createElement('strong');
      title.className = 'bank-concept-title';
      title.textContent = item.description || 'Movimiento';
      concept.appendChild(title);

      const detail = renderWagerDetail(item);
      if (detail) concept.appendChild(detail);
      tr.appendChild(concept);

      const category = document.createElement('td');
      category.textContent = item.category || '—';
      tr.appendChild(category);

      const amount = document.createElement('td');
      const income = item.direction === 'income';
      amount.className = income ? 'bank-positive' : 'bank-negative';
      amount.textContent = (income ? '+' : '−') + money(item.amount_m) + ' M';
      tr.appendChild(amount);

      body.appendChild(tr);
    });
  }

  async function loadBank() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) return window.location.replace('index.html');

    const [dashboardResponse, historyResponse, transfersResponse] = await Promise.all([
      client.rpc('driver_bank_dashboard'),
      client.rpc('driver_bank_history_v2', { p_limit: 100 }),
      client.rpc('driver_transfer_history', { p_limit: 100 })
    ]);

    const failed = [dashboardResponse, historyResponse, transfersResponse].find(r => r.error);
    if (failed) {
      console.error(failed.error);
      return showError(failed.error?.message || 'No se pudo cargar el Banco del Piloto.');
    }

    const data = Array.isArray(dashboardResponse.data) ? dashboardResponse.data[0] : dashboardResponse.data;
    if (!data) return showError('Tu cuenta no tiene un piloto vinculado.');

    $('driverName').textContent = '#' + (data.race_number ?? '--') + ' ' + (data.nickname || 'Piloto');
    $('driverContext').textContent = (data.current_team_name || 'Sin escudería') + ' · ' + (data.current_division ? (data.current_division === 'academy' ? 'Academy' : 'HyperDrive') : 'Sin división');
    $('availableBalance').textContent = money(data.available_balance_m);
    $('currentBalance').textContent = money(data.current_balance_m);
    $('reservedBalance').textContent = money(data.reserved_balance_m);
    $('teamName').value = data.current_team_name || 'Sin escudería';
    $('transferSubmit').disabled = !data.current_team_id;

    renderHistory(historyResponse.data || []);
    renderTransfers(transfersResponse.data || []);

    $('loadingPanel').classList.add('is-hidden');
    $('errorPanel').classList.add('is-hidden');
    $('bankContent').classList.remove('is-hidden');
  }

  $('transferForm').addEventListener('submit', async event => {
    event.preventDefault();
    setMessage('');
    const amount = Number($('transferAmount').value);
    const note = $('transferNote').value.trim();
    if (!Number.isFinite(amount) || amount <= 0) return setMessage('Introduce un importe válido.', 'error');

    $('transferSubmit').disabled = true;
    $('transferSubmit').querySelector('span').textContent = 'ENVIANDO…';

    const { error } = await client.rpc('request_driver_team_transfer', {
      p_direction: 'driver_to_team',
      p_amount_m: amount,
      p_season_number: config.currentSeason,
      p_driver_id: null,
      p_note: note || null
    });

    $('transferSubmit').querySelector('span').textContent = 'SOLICITAR TRANSFERENCIA';
    $('transferSubmit').disabled = false;

    if (error) {
      console.error(error);
      return setMessage(error.message || 'No se pudo crear la solicitud.', 'error');
    }

    $('transferAmount').value = '';
    $('transferNote').value = '';
    setMessage('Solicitud enviada. El importe queda reservado hasta que Administración la revise.', 'ok');
    await loadBank();
  });

  $('logoutButton').addEventListener('click', async () => {
    await client.auth.signOut();
    window.location.replace('index.html');
  });

  loadBank();
})();