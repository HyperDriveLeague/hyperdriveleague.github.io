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
    $('transferContent').classList.add('is-hidden');
    $('errorPanel').textContent = message;
    $('errorPanel').classList.remove('is-hidden');
  }

  function setMessage(message = '', type = '') {
    $('formMessage').textContent = message;
    $('formMessage').className = 'transfer-form-message' + (type ? ' ' + type : '');
  }

  function renderDrivers(items) {
    const select = $('driverSelect');
    select.innerHTML = '<option value="">Selecciona un piloto</option>';
    const list = $('driversList');
    list.innerHTML = '';

    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item.driver_id;
      option.textContent = '#' + (item.race_number ?? '--') + ' ' + item.driver_name + ' · ' + (item.division === 'academy' ? 'Academy' : 'HyperDrive') + (item.roster_status === 'reserve' ? ' · Reserva' : '');
      select.appendChild(option);

      const row = document.createElement('div');
      row.className = 'driver-roster-row';
      const name = document.createElement('strong');
      name.textContent = '#' + (item.race_number ?? '--') + ' ' + item.driver_name;
      const meta = document.createElement('span');
      meta.textContent = (item.division === 'academy' ? 'Academy' : 'HyperDrive') + ' · ' + (item.roster_status === 'reserve' ? 'Reserva' : 'Oficial') + (Number(item.pending_to_driver_m) > 0 ? ' · ' + money(item.pending_to_driver_m) + ' M pendientes' : '');
      row.append(name, meta);
      list.appendChild(row);
    });
  }

  function renderHistory(items) {
    const target = $('historyList');
    target.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'transfer-empty';
      empty.textContent = 'No hay solicitudes de transferencia.';
      target.appendChild(empty);
      return;
    }

    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'transfer-row';
      const top = document.createElement('div');
      top.className = 'transfer-row-top';
      const title = document.createElement('strong');
      title.textContent = item.direction === 'team_to_driver'
        ? 'Escudería → #' + (item.driver_number ?? '--') + ' ' + item.driver_name
        : '#' + (item.driver_number ?? '--') + ' ' + item.driver_name + ' → Escudería';
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

  async function load() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) return window.location.replace('index.html');

    const [dashboardResponse, driversResponse, historyResponse] = await Promise.all([
      client.rpc('team_transfer_dashboard', { p_season_number: config.currentSeason }),
      client.rpc('team_driver_transfer_overview', { p_season_number: config.currentSeason }),
      client.rpc('team_transfer_history', { p_season_number: config.currentSeason, p_limit: 150 })
    ]);

    const failed = [dashboardResponse, driversResponse, historyResponse].find(r => r.error);
    if (failed) {
      console.error(failed.error);
      return showError(failed.error?.message || 'No se pudieron cargar las transferencias.');
    }

    const dashboard = Array.isArray(dashboardResponse.data) ? dashboardResponse.data[0] : dashboardResponse.data;
    $('teamName').textContent = dashboard?.team_name || 'Escudería';
    $('availableBalance').textContent = money(dashboard?.available_balance_m);
    $('currentBalance').textContent = money(dashboard?.current_balance_m);
    $('reservedBalance').textContent = money(dashboard?.reserved_outgoing_m);

    renderDrivers(driversResponse.data || []);
    renderHistory(historyResponse.data || []);

    $('loadingPanel').classList.add('is-hidden');
    $('errorPanel').classList.add('is-hidden');
    $('transferContent').classList.remove('is-hidden');
  }

  $('teamTransferForm').addEventListener('submit', async event => {
    event.preventDefault();
    setMessage('');
    const driverId = $('driverSelect').value;
    const amount = Number($('amountInput').value);
    const note = $('noteInput').value.trim();

    if (!driverId) return setMessage('Selecciona un piloto.', 'error');
    if (!Number.isFinite(amount) || amount <= 0) return setMessage('Introduce un importe válido.', 'error');

    $('submitButton').disabled = true;
    $('submitButton').querySelector('span').textContent = 'ENVIANDO…';

    const response = await client.rpc('request_driver_team_transfer', {
      p_direction: 'team_to_driver',
      p_amount_m: amount,
      p_season_number: config.currentSeason,
      p_driver_id: driverId,
      p_note: note || null
    });

    $('submitButton').disabled = false;
    $('submitButton').querySelector('span').textContent = 'SOLICITAR TRANSFERENCIA';

    if (response.error) {
      console.error(response.error);
      return setMessage(response.error.message || 'No se pudo crear la solicitud.', 'error');
    }

    $('amountInput').value = '';
    $('noteInput').value = '';
    setMessage('Solicitud enviada. El importe queda reservado hasta que Administración la apruebe o rechace.', 'ok');
    await load();
  });

  $('logoutButton').addEventListener('click', async () => {
    await client.auth.signOut();
    window.location.replace('index.html');
  });

  load();
})();