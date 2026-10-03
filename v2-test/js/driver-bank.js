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
      const cells = [
        dateTime(item.transaction_at),
        item.description || 'Movimiento',
        item.category || '—'
      ];
      cells.forEach(text => {
        const td = document.createElement('td');
        td.textContent = text;
        tr.appendChild(td);
      });
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
      client.rpc('driver_bank_history', { p_limit: 100 }),
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