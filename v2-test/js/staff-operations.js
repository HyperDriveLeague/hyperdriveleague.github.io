(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const root = document.getElementById('staffOperations');
  if (!root || !config || !window.supabase) return;

  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const tabButtons = [...document.querySelectorAll('[data-operation-tab]')];
  const panels = [...document.querySelectorAll('[data-operation-panel]')];
  const sanctionForm = document.getElementById('sportSanctionForm');
  const sanctionArticle = document.getElementById('sanctionArticle');
  const sanctionDriver = document.getElementById('sanctionDriver');
  const sanctionTeam = document.getElementById('sanctionTeam');
  const sanctionTeamMode = document.getElementById('sanctionTeamMode');
  const beneficiaryTeam = document.getElementById('beneficiaryTeam');
  const sanctionRound = document.getElementById('sanctionRound');
  const sanctionDate = document.getElementById('sanctionDate');
  const articleSeconds = document.getElementById('articleSeconds');
  const articlePoints = document.getElementById('articlePoints');
  const articleDescription = document.getElementById('articleDescription');
  const sanctionStatus = document.getElementById('sanctionStatus');
  const sanctionSubmit = document.getElementById('sanctionSubmit');

  const fineForm = document.getElementById('fineForm');
  const fineDriver = document.getElementById('fineDriver');
  const fineTeam = document.getElementById('fineTeam');
  const fineTeamMode = document.getElementById('fineTeamMode');
  const fineDescription = document.getElementById('fineDescription');
  const fineAmount = document.getElementById('fineAmount');
  const fineRound = document.getElementById('fineRound');
  const fineDate = document.getElementById('fineDate');
  const fineStatus = document.getElementById('fineStatus');
  const fineSubmit = document.getElementById('fineSubmit');

  const manualForm = document.getElementById('manualMovementForm');
  const manualTeam = document.getElementById('manualTeam');
  const manualDirection = document.getElementById('manualDirection');
  const manualAmount = document.getElementById('manualAmount');
  const manualDescription = document.getElementById('manualDescription');
  const manualRound = document.getElementById('manualRound');
  const manualDate = document.getElementById('manualDate');
  const manualStatus = document.getElementById('manualStatus');
  const manualSubmit = document.getElementById('manualSubmit');
  const pendingSanctionsList = document.getElementById('pendingSanctionsList');

  let session = null;
  let articles = [];
  let articleByCode = new Map();
  let drivers = [];
  let teams = [];
  let teamById = new Map();
  let rosterRows = [];
  let licenses = [];
  let licenseById = new Map();

  const localToday = () => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };
  const formatDate = value => value ? new Intl.DateTimeFormat('es-ES').format(new Date(`${value}T12:00:00`)) : '—';
  const setStatus = (el, text = '', type = '') => {
    el.textContent = text;
    el.className = `operation-status${type ? ` ${type}` : ''}`;
  };
  const setBusy = (button, busy, busyText, normalText) => {
    button.disabled = busy;
    const span = button.querySelector('span');
    if (span) span.textContent = busy ? busyText : normalText;
  };

  function showTab(key) {
    tabButtons.forEach(button => button.classList.toggle('active', button.dataset.operationTab === key));
    panels.forEach(panel => panel.classList.toggle('is-hidden', panel.dataset.operationPanel !== key));
  }

  function activeOfficialRoster(driverId, roundValue) {
    if (!driverId) return null;
    const round = Number(roundValue || 0);
    const rows = rosterRows.filter(row => row.driver_id === driverId && row.roster_status === 'official');
    if (round > 0) {
      return rows.filter(row => Number(row.start_round || 1) <= round && (row.end_round == null || Number(row.end_round) >= round))
        .sort((a, b) => Number(b.start_round || 1) - Number(a.start_round || 1))[0] || null;
    }
    return rows.find(row => row.is_active) || null;
  }

  function populateTeamSelect(select, blankLabel = 'Selecciona escudería') {
    select.innerHTML = '';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = blankLabel;
    select.appendChild(blank);
    [...teams].sort((a, b) => a.name.localeCompare(b.name, 'es')).forEach(team => {
      const option = document.createElement('option');
      option.value = team.id;
      option.textContent = team.name;
      select.appendChild(option);
    });
  }

  function populateDriverSelect(select) {
    select.innerHTML = '<option value="">Selecciona piloto</option>';
    [...drivers].sort((a, b) => String(a.nickname || '').localeCompare(String(b.nickname || ''), 'es')).forEach(driver => {
      const option = document.createElement('option');
      option.value = driver.id;
      option.textContent = `#${driver.race_number ?? '--'} · ${driver.nickname}`;
      select.appendChild(option);
    });
  }

  function populateArticles() {
    sanctionArticle.innerHTML = '<option value="">Selecciona artículo</option>';
    const grouped = new Map();
    [...articles].sort((a, b) => Number(a.sort_order) - Number(b.sort_order)).forEach(article => {
      if (!grouped.has(article.section_name)) grouped.set(article.section_name, []);
      grouped.get(article.section_name).push(article);
    });
    grouped.forEach((items, section) => {
      const group = document.createElement('optgroup');
      group.label = section;
      items.forEach(article => {
        const option = document.createElement('option');
        option.value = article.article_code;
        option.textContent = `${article.article_code} · ${article.description}`;
        group.appendChild(option);
      });
      sanctionArticle.appendChild(group);
    });
  }

  function syncArticlePreview() {
    const article = articleByCode.get(sanctionArticle.value);
    if (!article) {
      articleSeconds.textContent = '—';
      articlePoints.textContent = '—';
      articleDescription.textContent = 'Selecciona un artículo para cargar la sanción del reglamento.';
      articleDescription.classList.remove('special-warning');
      return;
    }
    articleSeconds.textContent = article.seconds_text;
    articlePoints.textContent = article.points_text;
    articleDescription.textContent = article.description;
    articleDescription.classList.toggle('special-warning', article.points_numeric == null && article.points_text !== '-');
  }

  function syncDriverTeam(driverSelect, roundInput, teamSelect, modeLabel, refreshBeneficiary = false) {
    const roster = activeOfficialRoster(driverSelect.value, roundInput.value);
    if (roster?.team_id) {
      teamSelect.value = roster.team_id;
      teamSelect.disabled = true;
      modeLabel.textContent = `Escudería oficial: ${teamById.get(roster.team_id)?.name || 'asignada'}`;
      modeLabel.classList.remove('manual');
    } else {
      teamSelect.disabled = false;
      if (!teamSelect.value || !teamById.has(teamSelect.value)) teamSelect.value = '';
      modeLabel.textContent = 'Reserva / sin asiento oficial: selecciona la escudería manualmente.';
      modeLabel.classList.add('manual');
    }
    if (refreshBeneficiary) syncBeneficiaryOptions();
  }

  function syncBeneficiaryOptions() {
    const current = beneficiaryTeam.value;
    const payer = sanctionTeam.value;
    populateTeamSelect(beneficiaryTeam, 'Sin escudería beneficiada');
    [...beneficiaryTeam.options].forEach(option => {
      if (option.value && option.value === payer) option.remove();
    });
    if (current && current !== payer && teamById.has(current)) beneficiaryTeam.value = current;
  }

  async function loadPendingSanctions() {
    pendingSanctionsList.textContent = 'Cargando sanciones pendientes…';
    if (!licenses.length) {
      pendingSanctionsList.textContent = 'No hay superlicencias activas.';
      return;
    }
    const { data, error } = await client.from('superlicense_events')
      .select('id,superlicense_id,round_number,event_date,event_type,description,status')
      .in('superlicense_id', licenses.map(item => item.id))
      .in('event_type', ['no_qualy', 'race_ban'])
      .eq('status', 'pending')
      .order('event_date', { ascending: true, nullsFirst: false });
    pendingSanctionsList.innerHTML = '';
    if (error) {
      const msg = document.createElement('div');
      msg.className = 'empty-sanctions';
      msg.textContent = 'No se pudieron cargar las sanciones pendientes.';
      pendingSanctionsList.appendChild(msg);
      return;
    }
    const items = data || [];
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-sanctions';
      empty.textContent = 'No hay NO QUALY ni RACE BAN pendientes de cumplir.';
      pendingSanctionsList.appendChild(empty);
      return;
    }
    items.forEach(event => {
      const license = licenseById.get(event.superlicense_id) || {};
      const driver = license.drivers || {};
      const card = document.createElement('div');
      card.className = 'pending-sanction';
      const head = document.createElement('div');
      head.className = 'pending-sanction-head';
      const copy = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = `#${driver.race_number ?? '--'} ${driver.nickname || 'Piloto'}`;
      const small = document.createElement('small');
      small.textContent = `${event.round_number ? `R${event.round_number}` : 'Sin ronda'} · ${formatDate(event.event_date)}${event.description ? ` · ${event.description}` : ''}`;
      copy.append(strong, small);
      const badge = document.createElement('span');
      badge.className = 'pending-sanction-badge';
      badge.textContent = event.event_type === 'race_ban' ? 'RACE BAN' : 'NO QUALY';
      head.append(copy, badge);
      const actions = document.createElement('div');
      actions.className = 'pending-sanction-actions';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'serve-button';
      button.textContent = 'MARCAR COMO CUMPLIDA';
      button.addEventListener('click', async () => {
        const extra = event.event_type === 'race_ban' ? '\n\nSi está a 0 puntos, recuperará 6 automáticamente.' : '';
        if (!window.confirm(`¿Marcar esta sanción como cumplida?${extra}`)) return;
        button.disabled = true;
        const response = await client.from('superlicense_events').update({ status: 'served' }).eq('id', event.id).eq('status', 'pending');
        if (response.error) {
          button.disabled = false;
          window.alert(response.error.message || 'No se pudo actualizar la sanción.');
          return;
        }
        window.location.reload();
      });
      actions.appendChild(button);
      card.append(head, actions);
      pendingSanctionsList.appendChild(card);
    });
  }

  sanctionForm.addEventListener('submit', async event => {
    event.preventDefault();
    setStatus(sanctionStatus);
    const article = articleByCode.get(sanctionArticle.value);
    if (!article) return setStatus(sanctionStatus, 'Selecciona un artículo.', 'error');
    if (!sanctionDriver.value) return setStatus(sanctionStatus, 'Selecciona un piloto.', 'error');
    if (!sanctionTeam.value) return setStatus(sanctionStatus, 'Selecciona la escudería.', 'error');
    if (!sanctionDate.value) return setStatus(sanctionStatus, 'Selecciona la fecha.', 'error');
    if (beneficiaryTeam.value && beneficiaryTeam.value === sanctionTeam.value) return setStatus(sanctionStatus, 'La escudería beneficiada debe ser distinta.', 'error');

    const driver = drivers.find(item => item.id === sanctionDriver.value);
    const team = teamById.get(sanctionTeam.value);
    const beneficiary = teamById.get(beneficiaryTeam.value);
    const special = article.points_numeric == null && article.points_text !== '-';
    let message = `¿Registrar sanción?\n\n${driver?.nickname || 'Piloto'} · ${team?.name || ''}\n${article.article_code}\n${article.description}\nSegundos: ${article.seconds_text}\nPuntos: ${article.points_text}`;
    if (special) message += '\n\nEl valor de puntos es especial y NO se descontará automáticamente.';
    if (beneficiary) message += `\n\nSe transferirán 0,50 M de ${team?.name} a ${beneficiary.name}.`;
    if (!window.confirm(message)) return;

    setBusy(sanctionSubmit, true, 'GUARDANDO…', 'REGISTRAR SANCIÓN');
    const { error } = await client.rpc('staff_apply_sporting_sanction', {
      p_driver_id: sanctionDriver.value,
      p_article_code: sanctionArticle.value,
      p_team_id: sanctionTeam.value || null,
      p_beneficiary_team_id: beneficiaryTeam.value || null,
      p_round_number: sanctionRound.value ? Number(sanctionRound.value) : null,
      p_sanction_date: sanctionDate.value,
      p_season_number: config.currentSeason
    });
    setBusy(sanctionSubmit, false, 'GUARDANDO…', 'REGISTRAR SANCIÓN');
    if (error) return setStatus(sanctionStatus, error.message || 'No se pudo registrar la sanción.', 'error');
    setStatus(sanctionStatus, 'Sanción registrada correctamente.', 'success');
    window.setTimeout(() => window.location.reload(), 650);
  });

  fineForm.addEventListener('submit', async event => {
    event.preventDefault();
    setStatus(fineStatus);
    if (!fineDriver.value) return setStatus(fineStatus, 'Selecciona un piloto.', 'error');
    if (!fineTeam.value) return setStatus(fineStatus, 'Selecciona la escudería.', 'error');
    if (!fineDescription.value.trim()) return setStatus(fineStatus, 'Escribe la descripción de la multa.', 'error');
    const amount = Number(fineAmount.value || 0);
    if (!(amount > 0)) return setStatus(fineStatus, 'Indica una cantidad mayor que 0.', 'error');
    if (!fineDate.value) return setStatus(fineStatus, 'Selecciona la fecha.', 'error');
    const driver = drivers.find(item => item.id === fineDriver.value);
    const team = teamById.get(fineTeam.value);
    if (!window.confirm(`¿Registrar multa?\n\nPiloto: ${driver?.nickname || ''}\nEscudería: ${team?.name || ''}\nImporte: -${amount.toFixed(2)} M\n${fineDescription.value.trim()}`)) return;

    setBusy(fineSubmit, true, 'GUARDANDO…', 'REGISTRAR MULTA');
    const { error } = await client.rpc('staff_add_team_fine', {
      p_driver_id: fineDriver.value,
      p_team_id: fineTeam.value,
      p_description: fineDescription.value.trim(),
      p_amount_m: amount,
      p_round_number: fineRound.value ? Number(fineRound.value) : null,
      p_fine_date: fineDate.value,
      p_season_number: config.currentSeason
    });
    setBusy(fineSubmit, false, 'GUARDANDO…', 'REGISTRAR MULTA');
    if (error) return setStatus(fineStatus, error.message || 'No se pudo registrar la multa.', 'error');
    setStatus(fineStatus, 'Multa registrada y descontada de la escudería.', 'success');
    window.setTimeout(() => window.location.reload(), 650);
  });

  manualForm.addEventListener('submit', async event => {
    event.preventDefault();
    setStatus(manualStatus);
    if (!manualTeam.value) return setStatus(manualStatus, 'Selecciona una escudería.', 'error');
    if (!manualDescription.value.trim()) return setStatus(manualStatus, 'Escribe una descripción.', 'error');
    const amount = Number(manualAmount.value || 0);
    if (!(amount > 0)) return setStatus(manualStatus, 'Indica una cantidad mayor que 0.', 'error');
    if (!manualDate.value) return setStatus(manualStatus, 'Selecciona la fecha.', 'error');
    const team = teamById.get(manualTeam.value);
    const sign = manualDirection.value === 'income' ? '+' : '-';
    if (!window.confirm(`¿Añadir movimiento?\n\nEscudería: ${team?.name || ''}\nMovimiento: ${sign}${amount.toFixed(2)} M\n${manualDescription.value.trim()}`)) return;

    setBusy(manualSubmit, true, 'GUARDANDO…', 'AÑADIR MOVIMIENTO');
    const { error } = await client.rpc('staff_add_manual_team_movement', {
      p_team_id: manualTeam.value,
      p_description: manualDescription.value.trim(),
      p_direction: manualDirection.value,
      p_amount_m: amount,
      p_round_number: manualRound.value ? Number(manualRound.value) : null,
      p_transaction_date: manualDate.value,
      p_season_number: config.currentSeason
    });
    setBusy(manualSubmit, false, 'GUARDANDO…', 'AÑADIR MOVIMIENTO');
    if (error) return setStatus(manualStatus, error.message || 'No se pudo añadir el movimiento.', 'error');
    setStatus(manualStatus, 'Movimiento añadido correctamente.', 'success');
    manualForm.reset();
    manualDate.value = localToday();
  });

  tabButtons.forEach(button => button.addEventListener('click', () => showTab(button.dataset.operationTab)));
  sanctionArticle.addEventListener('change', syncArticlePreview);
  sanctionDriver.addEventListener('change', () => syncDriverTeam(sanctionDriver, sanctionRound, sanctionTeam, sanctionTeamMode, true));
  sanctionRound.addEventListener('input', () => syncDriverTeam(sanctionDriver, sanctionRound, sanctionTeam, sanctionTeamMode, true));
  sanctionTeam.addEventListener('change', syncBeneficiaryOptions);
  fineDriver.addEventListener('change', () => syncDriverTeam(fineDriver, fineRound, fineTeam, fineTeamMode));
  fineRound.addEventListener('input', () => syncDriverTeam(fineDriver, fineRound, fineTeam, fineTeamMode));

  async function init() {
    const { data: { session: activeSession } } = await client.auth.getSession();
    if (!activeSession) return;
    session = activeSession;
    const roles = await client.from('user_roles').select('role').eq('user_id', session.user.id).in('role', ['staff', 'admin']);
    if (roles.error || !(roles.data || []).length) return;

    const [articlesResponse, driversResponse, teamsResponse, rosterResponse, licensesResponse] = await Promise.all([
      client.from('sporting_sanction_articles').select('article_code,section_name,seconds_text,points_text,points_numeric,description,sort_order').eq('is_active', true),
      client.from('drivers').select('id,nickname,race_number').eq('is_active', true),
      client.from('teams').select('id,name').eq('is_active', true),
      client.from('season_roster').select('driver_id,team_id,roster_status,start_round,end_round,is_active').eq('season_number', config.currentSeason),
      client.from('superlicenses').select('id,driver_id,drivers:driver_id(nickname,race_number)').eq('season_number', config.currentSeason).eq('is_active', true)
    ]);
    if (articlesResponse.error || driversResponse.error || teamsResponse.error || rosterResponse.error || licensesResponse.error) {
      setStatus(sanctionStatus, 'No se pudieron cargar los datos de operaciones.', 'error');
      return;
    }

    articles = articlesResponse.data || [];
    articleByCode = new Map(articles.map(item => [item.article_code, item]));
    drivers = driversResponse.data || [];
    teams = teamsResponse.data || [];
    teamById = new Map(teams.map(item => [item.id, item]));
    rosterRows = rosterResponse.data || [];
    licenses = licensesResponse.data || [];
    licenseById = new Map(licenses.map(item => [item.id, item]));

    populateArticles();
    populateDriverSelect(sanctionDriver);
    populateDriverSelect(fineDriver);
    populateTeamSelect(sanctionTeam);
    populateTeamSelect(fineTeam);
    populateTeamSelect(beneficiaryTeam, 'Sin escudería beneficiada');
    populateTeamSelect(manualTeam);
    const today = localToday();
    sanctionDate.value = today;
    fineDate.value = today;
    manualDate.value = today;
    syncArticlePreview();
    showTab('sanctions');
    await loadPendingSanctions();
  }

  init();
})();
