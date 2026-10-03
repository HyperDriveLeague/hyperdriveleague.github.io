(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const $ = id => document.getElementById(id);
  const money = value => Number(value || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const statusLabels = { pending:'PENDIENTE', settled:'LIQUIDADO', void:'ANULADO' };
  let activeDivision = 'academy';
  let events = [];
  let currentEvent = null;
  let currentDraw = null;
  let lineup = [];
  let overview = null;

  const formatDateTime = value => value ? new Intl.DateTimeFormat('es-ES', {
    timeZone:'Europe/Madrid', weekday:'short', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'
  }).format(new Date(value)) : '—';

  function setError(message) {
    $('loadingPanel').classList.add('is-hidden');
    $('lotoContent').classList.add('is-hidden');
    $('errorPanel').textContent = message;
    $('errorPanel').classList.remove('is-hidden');
  }

  function setMessage(message = '', type = '') {
    $('lotoMessage').textContent = message;
    $('lotoMessage').className = 'bet-message' + (type ? ' ' + type : '');
  }

  function eventFor(division) {
    const list = events.filter(e => e.division === division && e.status !== 'settled');
    return list.find(e => e.status === 'open') || list.find(e => e.status === 'upcoming') || list.find(e => e.status === 'closed') || null;
  }

  function optionPlaceholder(text) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = text;
    return option;
  }

  function fillDriverSelect(select, placeholder) {
    const previous = select.value;
    select.innerHTML = '';
    select.appendChild(optionPlaceholder(placeholder));
    lineup.forEach(driver => {
      const option = document.createElement('option');
      option.value = driver.driver_id;
      option.textContent = '#' + (driver.race_number ?? '--') + ' ' + driver.nickname + (driver.team_name ? ' · ' + driver.team_name : '');
      select.appendChild(option);
    });
    if ([...select.options].some(o => o.value === previous)) select.value = previous;
  }

  function syncTop10Options() {
    const selects = [...document.querySelectorAll('.top10-select')];
    selects.forEach(select => {
      const own = select.value;
      const used = new Set(selects.filter(x => x !== select).map(x => x.value).filter(Boolean));
      [...select.options].forEach(option => {
        option.disabled = !!option.value && option.value !== own && used.has(option.value);
      });
    });
  }

  function buildTop10() {
    const target = $('top10Builder');
    target.innerHTML = '';
    for (let i = 1; i <= 10; i += 1) {
      const row = document.createElement('label');
      row.className = 'top10-row';
      const label = document.createElement('span');
      const badge = document.createElement('strong');
      badge.textContent = 'P' + i;
      const copy = document.createTextNode(' POSICIÓN ' + i);
      label.append(badge, copy);
      const select = document.createElement('select');
      select.className = 'top10-select';
      select.dataset.position = String(i);
      select.required = true;
      fillDriverSelect(select, 'Selecciona piloto');
      select.addEventListener('change', syncTop10Options);
      row.append(label, select);
      target.appendChild(row);
    }
  }

  function renderHeader() {
    $('jackpotDivision').textContent = activeDivision.toUpperCase();
    if (!currentEvent || !overview) {
      $('lotoEventTitle').textContent = 'Sin sorteo disponible';
      $('drawTiming').textContent = 'No hay una carrera preparada para esta división.';
      $('lotoStatus').textContent = 'CERRADO';
      return;
    }

    $('lotoEventTitle').textContent = 'R' + currentEvent.round_number + ' · GP ' + currentEvent.grand_prix;
    $('jackpotAmount').textContent = money(overview.current_jackpot_m) + ' M';
    $('projectedJackpot').textContent = money(overview.projected_jackpot_m) + ' M';
    $('ticketPrice').textContent = money(overview.ticket_price_m) + ' M';
    $('ticketCount').textContent = overview.ticket_count ?? 0;
    $('grossSales').textContent = money(overview.gross_sales_m) + ' M recaudados';
    $('buyTicketButton').textContent = 'COMPRAR BOLETO · ' + money(overview.ticket_price_m) + ' M';

    if (currentEvent.status === 'open') {
      $('lotoStatus').textContent = 'ABIERTO';
      $('drawTiming').textContent = 'Cierre: ' + formatDateTime(currentEvent.closes_at) + ' · Liquidación: ' + formatDateTime(currentEvent.settles_at);
      $('buyTicketButton').disabled = false;
    } else if (currentEvent.status === 'upcoming') {
      $('lotoStatus').textContent = 'PRÓXIMAMENTE';
      $('drawTiming').textContent = 'Apertura: ' + formatDateTime(currentEvent.opens_at);
      $('buyTicketButton').disabled = true;
    } else {
      $('lotoStatus').textContent = 'CERRADO';
      $('drawTiming').textContent = 'Liquidación: ' + formatDateTime(currentEvent.settles_at);
      $('buyTicketButton').disabled = true;
    }
  }

  function renderPrizeBands() {
    const target = $('prizeBands');
    target.innerHTML = '';
    const bands = overview?.prize_bands || {};
    [10,9,8,7,6].forEach(hits => {
      const row = document.createElement('div');
      row.className = 'prize-band';
      const label = document.createElement('span');
      label.textContent = hits + ' aciertos exactos';
      const value = document.createElement('strong');
      value.textContent = money(bands[String(hits)] || 0) + ' M';
      row.append(label, value);
      target.appendChild(row);
    });
  }

  function renderTickets(items) {
    const target = $('myTickets');
    target.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'wager-empty';
      empty.textContent = 'Todavía no hay boletos para esta carrera.';
      target.appendChild(empty);
      return;
    }

    items.forEach(item => {
      const card = document.createElement('article');
      card.className = 'my-bet-card';
      const top = document.createElement('div');
      top.className = 'my-bet-top';
      const title = document.createElement('strong');
      title.textContent = 'BOLETO · ' + money(item.ticket_price_m) + ' M';
      const state = document.createElement('span');
      state.className = item.status === 'settled' ? (Number(item.payout_m) > 0 ? 'bet-won' : 'bet-lost') : 'bet-pending';
      state.textContent = statusLabels[item.status] || String(item.status).toUpperCase();
      top.append(title, state);

      const summary = document.createElement('p');
      summary.textContent = 'Pole: ' + item.pole_driver_name + ' · Vuelta rápida: ' + item.fastest_lap_driver_name
        + (item.status === 'settled'
          ? ' · Aciertos: ' + (item.exact_position_hits ?? 0) + '/10 · Premio: ' + money(item.payout_m) + ' M'
          : '');

      const picks = document.createElement('div');
      picks.className = 'ticket-picks';
      (item.top10 || []).forEach(pick => {
        const chip = document.createElement('span');
        chip.textContent = 'P' + pick.position + ' ' + pick.driver_name;
        picks.appendChild(chip);
      });

      card.append(top, summary, picks);
      target.appendChild(card);
    });
  }

  async function loadDivision() {
    currentEvent = eventFor(activeDivision);
    currentDraw = null;
    lineup = [];
    overview = null;
    setMessage('');

    if (!currentEvent) {
      renderHeader();
      renderPrizeBands();
      renderTickets([]);
      return;
    }

    const drawResponse = await client.from('hyperloto_draws').select('id,event_id').eq('event_id', currentEvent.id).maybeSingle();
    if (drawResponse.error) throw drawResponse.error;
    currentDraw = drawResponse.data;
    if (!currentDraw) throw new Error('No existe el sorteo HyperLoto para esta carrera.');

    const [lineupResponse, overviewResponse, ticketsResponse] = await Promise.all([
      client.rpc('wagering_official_lineup', { p_event_id: currentEvent.id }),
      client.rpc('hyperloto_draw_overview', { p_draw_id: currentDraw.id }),
      client.rpc('hyperloto_my_tickets', { p_draw_id: currentDraw.id })
    ]);

    if (lineupResponse.error) throw lineupResponse.error;
    if (overviewResponse.error) throw overviewResponse.error;
    if (ticketsResponse.error) throw ticketsResponse.error;

    lineup = lineupResponse.data || [];
    overview = Array.isArray(overviewResponse.data) ? overviewResponse.data[0] : overviewResponse.data;

    fillDriverSelect($('poleSelect'), 'Selecciona la Pole');
    fillDriverSelect($('fastestSelect'), 'Selecciona la vuelta rápida');
    buildTop10();
    renderHeader();
    renderPrizeBands();
    renderTickets(ticketsResponse.data || []);
  }

  async function load() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) return window.location.replace('index.html');

    try {
      const [eventsResponse, bankResponse] = await Promise.all([
        client.from('wagering_events').select('*').eq('season_number', config.currentSeason).order('race_at'),
        client.rpc('driver_bank_dashboard')
      ]);
      if (eventsResponse.error) throw eventsResponse.error;
      if (bankResponse.error) throw bankResponse.error;
      events = eventsResponse.data || [];
      await loadDivision();
      $('loadingPanel').classList.add('is-hidden');
      $('errorPanel').classList.add('is-hidden');
      $('lotoContent').classList.remove('is-hidden');
    } catch (error) {
      console.error(error);
      setError(error.message || 'No se pudo cargar HyperLoto.');
    }
  }

  document.querySelectorAll('.division-tab').forEach(button => {
    button.addEventListener('click', async () => {
      activeDivision = button.dataset.division;
      document.querySelectorAll('.division-tab').forEach(x => x.classList.toggle('active', x === button));
      try { await loadDivision(); } catch (error) { setMessage(error.message || 'No se pudo cambiar de división.', 'error'); }
    });
  });

  $('lotoForm').addEventListener('submit', async event => {
    event.preventDefault();
    setMessage('');
    if (!currentDraw || currentEvent?.status !== 'open') return setMessage('HyperLoto no está abierto para esta carrera.', 'error');

    const top10 = [...document.querySelectorAll('.top10-select')].map(select => select.value);
    if (top10.some(x => !x) || new Set(top10).size !== 10) return setMessage('Completa el Top 10 sin repetir pilotos.', 'error');
    if (!$('poleSelect').value || !$('fastestSelect').value) return setMessage('Completa Pole y Vuelta Rápida.', 'error');

    $('buyTicketButton').disabled = true;
    $('buyTicketButton').textContent = 'COMPRANDO…';

    const response = await client.rpc('hyperloto_buy_ticket', {
      p_draw_id: currentDraw.id,
      p_pole_driver_id: $('poleSelect').value,
      p_fastest_lap_driver_id: $('fastestSelect').value,
      p_top10: top10
    });

    if (response.error) {
      console.error(response.error);
      renderHeader();
      return setMessage(response.error.message || 'No se pudo comprar el boleto.', 'error');
    }

    setMessage('Boleto registrado correctamente. Puedes comprar tantos como quieras.', 'ok');
    $('poleSelect').value = '';
    $('fastestSelect').value = '';
    [...document.querySelectorAll('.top10-select')].forEach(select => { select.value = ''; });
    syncTop10Options();

    try { await loadDivision(); } catch (error) { console.error(error); }
  });

  $('logoutButton').addEventListener('click', async () => {
    await client.auth.signOut();
    window.location.replace('index.html');
  });

  load();
})();