(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const $ = id => document.getElementById(id);
  const money = value => Number(value || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const marketLabels = { winner:'Ganador', pole:'Pole', podium:'Podio', top5:'Top 5', top10:'Top 10', fastest_lap:'Vuelta rápida' };
  const marketOrder = ['winner','pole','podium','top5','top10','fastest_lap'];
  const statusLabels = { pending:'PENDIENTE', won:'GANADA', lost:'PERDIDA', void:'ANULADA' };

  let activeDivision = 'academy';
  let events = [];
  let currentEvent = null;
  let markets = [];
  let settings = null;
  let slip = [];
  let bank = null;
  let activeMarketType = 'winner';

  const formatDateTime = value => value ? new Intl.DateTimeFormat('es-ES', {
    timeZone:'Europe/Madrid', weekday:'short', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'
  }).format(new Date(value)) : '—';

  function setError(message) {
    $('loadingPanel').classList.add('is-hidden');
    $('wagerContent').classList.add('is-hidden');
    $('errorPanel').textContent = message;
    $('errorPanel').classList.remove('is-hidden');
  }

  function setBetMessage(message = '', type = '') {
    $('betMessage').textContent = message;
    $('betMessage').className = 'bet-message' + (type ? ' ' + type : '');
  }

  function currentEventFor(division) {
    const list = events.filter(e => e.division === division && e.status !== 'settled');
    return list.find(e => e.status === 'open') || list.find(e => e.status === 'upcoming') || list.find(e => e.status === 'closed') || null;
  }

  function updateEventHeader() {
    if (!currentEvent) {
      $('eventTitle').textContent = 'Sin mercados disponibles';
      $('eventTiming').textContent = 'No hay una carrera preparada para esta división.';
      $('marketState').textContent = 'CERRADO';
      return;
    }
    $('eventTitle').textContent = 'R' + currentEvent.round_number + ' · GP ' + currentEvent.grand_prix;
    if (currentEvent.status === 'open') {
      $('marketState').textContent = 'APUESTAS ABIERTAS';
      $('eventTiming').textContent = 'Cierre: ' + formatDateTime(currentEvent.closes_at) + ' · Liquidación: ' + formatDateTime(currentEvent.settles_at);
    } else if (currentEvent.status === 'upcoming') {
      $('marketState').textContent = 'PRÓXIMAMENTE';
      $('eventTiming').textContent = 'Apertura: ' + formatDateTime(currentEvent.opens_at);
    } else {
      $('marketState').textContent = 'APUESTAS CERRADAS';
      $('eventTiming').textContent = 'Liquidación: ' + formatDateTime(currentEvent.settles_at);
    }
  }

  function selectionAlreadyConflicts(selection) {
    return slip.some(item => item.market_id === selection.market_id || item.driver_id === selection.driver_id);
  }

  function toggleSelection(selection) {
    const existingIndex = slip.findIndex(item => item.id === selection.id);
    if (existingIndex >= 0) {
      slip.splice(existingIndex, 1);
      setBetMessage('');
      return renderAll();
    }
    if (slip.length >= 5) return setBetMessage('Las combinadas admiten un máximo de 5 selecciones.', 'error');
    if (selectionAlreadyConflicts(selection)) return setBetMessage('No puedes combinar dos mercados del mismo piloto ni dos selecciones del mismo mercado.', 'error');
    slip.push(selection);
    setBetMessage('');
    renderAll();
  }

  function renderMarketTabs() {
    const target = $('marketTabs');
    target.innerHTML = '';
    const types = marketOrder.filter(type => markets.some(m => m.market_type === type));
    if (!types.includes(activeMarketType)) activeMarketType = types[0] || 'winner';
    types.forEach(type => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'market-tab' + (type === activeMarketType ? ' active' : '');
      button.textContent = marketLabels[type] || type;
      button.addEventListener('click', () => {
        activeMarketType = type;
        renderMarkets();
        renderMarketTabs();
      });
      target.appendChild(button);
    });
  }

  function renderMarkets() {
    const target = $('marketsContainer');
    target.innerHTML = '';
    const filtered = markets.filter(m => m.market_type === activeMarketType);
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'wager-empty';
      empty.textContent = currentEvent?.status === 'upcoming' ? 'Los mercados se generarán cuando se abra la ronda.' : 'No hay mercados disponibles.';
      target.appendChild(empty);
      return;
    }

    filtered.forEach(market => {
      const card = document.createElement('article');
      card.className = 'market-card';
      const head = document.createElement('div');
      head.className = 'market-head';
      const title = document.createElement('h3');
      title.textContent = market.title;
      const state = document.createElement('span');
      state.textContent = currentEvent?.status === 'open' && market.status === 'open' ? 'ABIERTO' : 'CERRADO';
      head.append(title, state);

      const list = document.createElement('div');
      list.className = 'selection-list';
      (market.hyperbet_selections || []).sort((a,b) => Number(a.current_odds) - Number(b.current_odds)).forEach(selection => {
        selection.market_id = market.id;
        selection.market_title = market.title;
        selection.market_type = market.market_type;

        const row = document.createElement('div');
        row.className = 'selection-row';
        const driver = document.createElement('div');
        driver.className = 'selection-driver';
        const strong = document.createElement('strong');
        strong.textContent = selection.selection_label;
        const team = document.createElement('span');
        team.textContent = selection.team_label || '—';
        driver.append(strong, team);

        const odds = document.createElement('button');
        odds.type = 'button';
        odds.className = 'odds-button' + (slip.some(item => item.id === selection.id) ? ' selected' : '');
        odds.disabled = currentEvent?.status !== 'open' || market.status !== 'open';
        const value = document.createTextNode(Number(selection.current_odds).toFixed(2));
        const small = document.createElement('small');
        const initial = Number(selection.initial_odds);
        const current = Number(selection.current_odds);
        small.textContent = current < initial ? '↓ desde ' + initial.toFixed(2) : current > initial ? '↑ desde ' + initial.toFixed(2) : 'apertura';
        odds.append(value, small);
        odds.addEventListener('click', () => toggleSelection(selection));

        row.append(driver, odds);
        list.appendChild(row);
      });

      card.append(head, list);
      target.appendChild(card);
    });
  }

  function combinedOdds() {
    if (!slip.length) return 0;
    const raw = slip.reduce((acc, item) => acc * Number(item.current_odds), 1);
    const cap = slip.length === 1 ? Number(settings?.max_simple_odds || 6) : Number(settings?.max_combo_odds || 8);
    return Math.min(Math.round(raw * 100) / 100, cap);
  }

  function renderSlip() {
    $('slipCount').textContent = slip.length + (slip.length === 1 ? ' selección' : ' selecciones');
    const target = $('slipItems');
    target.innerHTML = '';

    if (!slip.length) {
      const empty = document.createElement('div');
      empty.className = 'wager-empty';
      empty.textContent = 'Pulsa una cuota para añadirla.';
      target.appendChild(empty);
    } else {
      slip.forEach(item => {
        const el = document.createElement('div');
        el.className = 'slip-item';
        const top = document.createElement('div');
        top.className = 'slip-item-top';
        const name = document.createElement('strong');
        name.textContent = item.selection_label + ' @' + Number(item.current_odds).toFixed(2);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = '✕';
        remove.addEventListener('click', () => {
          slip = slip.filter(x => x.id !== item.id);
          renderAll();
        });
        top.append(name, remove);
        const meta = document.createElement('span');
        meta.textContent = item.market_title;
        el.append(top, meta);
        target.appendChild(el);
      });
    }

    const odds = combinedOdds();
    $('combinedOdds').textContent = odds ? odds.toFixed(2) : '—';
    updatePotential();
  }

  function updatePotential() {
    const stake = Number($('stakeInput').value || 0);
    const odds = combinedOdds();
    const returnCap = slip.length <= 1 ? Number(settings?.max_simple_return_m || 12) : Number(settings?.max_combo_return_m || 15);
    const potential = stake > 0 && odds > 0 ? Math.min(Math.round(stake * odds * 100) / 100, returnCap) : 0;
    $('potentialReturn').textContent = money(potential) + ' M';
    $('potentialProfit').textContent = money(Math.max(0, potential - stake)) + ' M';

    const minStake = slip.length <= 1 ? Number(settings?.min_simple_stake_m || .1) : Number(settings?.min_combo_stake_m || .1);
    const maxStake = slip.length <= 1 ? Number(settings?.max_simple_stake_m || 2) : Number(settings?.max_combo_stake_m || 1);
    $('stakeInput').min = minStake;
    $('stakeInput').max = maxStake;
    $('placeBetButton').disabled = !slip.length || currentEvent?.status !== 'open' || !(stake >= minStake && stake <= maxStake);
  }

  function renderBets(items) {
    const target = $('myBets');
    target.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'wager-empty';
      empty.textContent = 'Todavía no hay apuestas para esta carrera.';
      target.appendChild(empty);
      return;
    }

    items.forEach(item => {
      const card = document.createElement('article');
      card.className = 'my-bet-card';
      const top = document.createElement('div');
      top.className = 'my-bet-top';
      const title = document.createElement('strong');
      title.textContent = (item.bet_type === 'combo' ? 'COMBINADA' : 'SIMPLE') + ' · ' + money(item.stake_m) + ' M · @' + Number(item.combined_odds).toFixed(2);
      const status = document.createElement('span');
      status.className = 'bet-' + item.status;
      status.textContent = statusLabels[item.status] || String(item.status).toUpperCase();
      top.append(title, status);

      const legs = Array.isArray(item.legs) ? item.legs : [];
      const p = document.createElement('p');
      p.textContent = legs.map(leg => leg.market + ': ' + leg.selection + ' @' + Number(leg.odds).toFixed(2)).join(' · ')
        + ' · Retorno: ' + money(item.status === 'won' || item.status === 'void' ? item.payout_m : item.potential_return_m) + ' M';
      card.append(top, p);
      target.appendChild(card);
    });
  }

  function renderPrizeHistory(items) {
    const target = $('hyperbetPrizeHistory');
    if (!target) return;
    target.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'wager-empty';
      empty.textContent = 'Todavía no se han entregado premios.';
      target.appendChild(empty);
      return;
    }

    items.forEach(item => {
      const card = document.createElement('article');
      card.className = 'public-prize-card';

      const main = document.createElement('div');
      main.className = 'public-prize-main';
      const name = document.createElement('strong');
      name.textContent = '#' + (item.race_number ?? '--') + ' ' + item.driver_name;
      const meta = document.createElement('span');
      meta.textContent = 'R' + item.round_number + ' · ' + (item.division === 'academy' ? 'Academy' : 'HyperDrive') + ' · GP ' + item.grand_prix;
      main.append(name, meta);

      const amount = document.createElement('div');
      amount.className = 'public-prize-amount';
      const value = document.createElement('strong');
      value.textContent = money(item.payout_m) + ' M';
      const label = document.createElement('span');
      label.textContent = 'PREMIO RECIBIDO';
      amount.append(value, label);

      card.append(main, amount);
      target.appendChild(card);
    });
  }

  async function loadPrizeHistory() {
    const response = await client.rpc('hyperbet_prize_history', { p_limit: 100 });
    if (response.error) {
      console.error('Error al cargar premios HyperBet:', response.error);
      renderPrizeHistory([]);
      return;
    }
    renderPrizeHistory(response.data || []);
  }

  function renderAll() {
    updateEventHeader();
    renderMarketTabs();
    renderMarkets();
    renderSlip();
  }

  async function loadMarketsAndBets() {
    currentEvent = currentEventFor(activeDivision);
    slip = [];
    if (!currentEvent) {
      markets = [];
      renderAll();
      renderBets([]);
      return;
    }

    const [marketsResponse, betsResponse] = await Promise.all([
      client.from('hyperbet_markets')
        .select('id,market_type,market_code,title,status,sort_order,hyperbet_selections(id,driver_id,selection_label,team_label,initial_odds,current_odds,sort_order,is_active)')
        .eq('event_id', currentEvent.id)
        .order('sort_order'),
      client.rpc('hyperbet_my_bets', { p_event_id: currentEvent.id })
    ]);

    if (marketsResponse.error) throw marketsResponse.error;
    if (betsResponse.error) throw betsResponse.error;
    markets = marketsResponse.data || [];
    renderAll();
    renderBets(betsResponse.data || []);
  }

  async function refreshBank() {
    const response = await client.rpc('driver_bank_dashboard');
    if (response.error) throw response.error;
    bank = Array.isArray(response.data) ? response.data[0] : response.data;
    $('walletBalance').textContent = money(bank?.available_balance_m);
  }

  async function load() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) return window.location.replace('index.html');

    try {
      const [eventsResponse, settingsResponse] = await Promise.all([
        client.from('wagering_events').select('*').eq('season_number', config.currentSeason).order('race_at'),
        client.from('hyperbet_settings').select('*').eq('id', true).single()
      ]);
      if (eventsResponse.error) throw eventsResponse.error;
      if (settingsResponse.error) throw settingsResponse.error;
      events = eventsResponse.data || [];
      settings = settingsResponse.data;
      await refreshBank();
      await loadMarketsAndBets();
      await loadPrizeHistory();

      $('loadingPanel').classList.add('is-hidden');
      $('errorPanel').classList.add('is-hidden');
      $('wagerContent').classList.remove('is-hidden');
    } catch (error) {
      console.error(error);
      setError(error.message || 'No se pudo cargar HyperBet.');
    }
  }

  document.querySelectorAll('.division-tab').forEach(button => {
    button.addEventListener('click', async () => {
      activeDivision = button.dataset.division;
      document.querySelectorAll('.division-tab').forEach(x => x.classList.toggle('active', x === button));
      setBetMessage('');
      try { await loadMarketsAndBets(); } catch (error) { setBetMessage(error.message || 'No se pudo cambiar de división.', 'error'); }
    });
  });

  $('stakeInput').addEventListener('input', updatePotential);

  $('placeBetButton').addEventListener('click', async () => {
    setBetMessage('');
    const stake = Number($('stakeInput').value);
    if (!slip.length || !stake) return;

    $('placeBetButton').disabled = true;
    $('placeBetButton').textContent = 'CONFIRMANDO…';

    const response = await client.rpc('hyperbet_place_bet', {
      p_selection_ids: slip.map(item => item.id),
      p_stake_m: stake
    });

    $('placeBetButton').textContent = 'CONFIRMAR APUESTA';

    if (response.error) {
      console.error(response.error);
      updatePotential();
      return setBetMessage(response.error.message || 'No se pudo registrar la apuesta.', 'error');
    }

    const placedOdds = combinedOdds();
    slip = [];
    $('stakeInput').value = '';
    setBetMessage('Apuesta registrada. Cuota fijada: ' + placedOdds.toFixed(2) + '.', 'ok');
    try {
      await refreshBank();
      await loadMarketsAndBets();
    } catch (error) {
      console.error(error);
    }
  });

  $('logoutButton').addEventListener('click', async () => {
    await client.auth.signOut();
    window.location.replace('index.html');
  });

  load();
})();