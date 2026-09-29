(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const root = document.getElementById('staffActions');
  if (!root || !config || !window.supabase) return;

  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const form = document.getElementById('staffEventForm');
  const licenseSelect = document.getElementById('eventLicense');
  const typeSelect = document.getElementById('eventType');
  const pointsInput = document.getElementById('eventPoints');
  const roundInput = document.getElementById('eventRound');
  const dateInput = document.getElementById('eventDate');
  const articleInput = document.getElementById('eventArticle');
  const descriptionInput = document.getElementById('eventDescription');
  const preview = document.getElementById('eventPreview');
  const status = document.getElementById('eventActionStatus');
  const submitButton = document.getElementById('eventSubmitButton');
  const sanctionsTarget = document.getElementById('pendingSanctionsList');

  let session = null;
  let licenses = [];
  let licenseById = new Map();

  const typeLabels = {
    points_penalty: 'Pérdida de puntos',
    points_restore: 'Recuperación de puntos',
    warning: 'Aviso',
    attendance_incident: 'Incidencia de asistencia',
    no_qualy: 'NO QUALY',
    race_ban: 'RACE BAN'
  };

  const formatDate = value => value ? new Intl.DateTimeFormat('es-ES').format(new Date(`${value}T12:00:00`)) : '—';

  function setStatus(message = '', type = '') {
    status.textContent = message;
    status.className = `staff-action-status${type ? ` ${type}` : ''}`;
  }

  function selectedLicense() {
    return licenseById.get(licenseSelect.value) || null;
  }

  function syncPointsField() {
    const type = typeSelect.value;
    const usesPoints = type === 'points_penalty' || type === 'points_restore';
    pointsInput.disabled = !usesPoints;
    pointsInput.required = usesPoints;
    if (!usesPoints) pointsInput.value = '0';
    else if (!Number(pointsInput.value)) pointsInput.value = '1';
    renderPreview();
  }

  function renderPreview() {
    const license = selectedLicense();
    if (!license) {
      preview.textContent = 'Selecciona un piloto para ver el efecto de la operación.';
      return;
    }
    const type = typeSelect.value;
    const current = Number(license.current_points || 0);
    const starting = Number(license.starting_points || 12);
    const amount = Math.max(0, Number(pointsInput.value || 0));
    let projected = current;
    if (type === 'points_penalty') projected = Math.max(0, current - amount);
    if (type === 'points_restore') projected = Math.min(starting, current + amount);

    if (type === 'points_penalty') {
      const lostAfter = Number(license.points_lost_since_rb || 0) + Math.min(current, amount);
      let extra = '';
      if (Number(license.points_lost_since_rb || 0) < 6 && lostAfter >= 6) extra += ' · generará NO QUALY automático';
      if (current > 0 && projected === 0) extra += ' · generará RACE BAN automático';
      preview.innerHTML = `Puntos: <strong>${current} → ${projected}</strong>${extra}`;
    } else if (type === 'points_restore') {
      preview.innerHTML = `Puntos: <strong>${current} → ${projected}</strong>`;
    } else {
      preview.innerHTML = `Puntos actuales: <strong>${current} / ${starting}</strong> · esta incidencia no modifica puntos.`;
    }
  }

  function populateLicenses() {
    licenseSelect.innerHTML = '<option value="">Selecciona piloto</option>';
    [...licenses]
      .sort((a, b) => String(a.drivers?.nickname || '').localeCompare(String(b.drivers?.nickname || ''), 'es'))
      .forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `#${item.drivers?.race_number ?? '--'} · ${item.drivers?.nickname || 'Piloto'} · ${item.current_points}/${item.starting_points}`;
        licenseSelect.appendChild(option);
      });
  }

  async function loadPendingSanctions() {
    sanctionsTarget.textContent = 'Cargando sanciones pendientes…';
    const { data, error } = await client
      .from('superlicense_events')
      .select('id,superlicense_id,round_number,event_date,event_type,description,status')
      .in('superlicense_id', licenses.map(item => item.id))
      .in('event_type', ['no_qualy', 'race_ban'])
      .eq('status', 'pending')
      .order('event_date', { ascending: true, nullsFirst: false });

    if (error) {
      sanctionsTarget.textContent = 'No se pudieron cargar las sanciones pendientes.';
      return;
    }

    sanctionsTarget.innerHTML = '';
    const items = data || [];
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-sanctions';
      empty.textContent = 'No hay NO QUALY ni RACE BAN pendientes de cumplir.';
      sanctionsTarget.appendChild(empty);
      return;
    }

    items.forEach(event => {
      const license = licenseById.get(event.superlicense_id) || {};
      const driver = license.drivers || {};
      const card = document.createElement('div');
      card.className = 'pending-sanction';

      const head = document.createElement('div');
      head.className = 'pending-sanction-head';
      const text = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = `#${driver.race_number ?? '--'} ${driver.nickname || 'Piloto'}`;
      const small = document.createElement('small');
      small.textContent = `${event.round_number ? `R${event.round_number}` : 'Sin ronda'} · ${formatDate(event.event_date)}${event.description ? ` · ${event.description}` : ''}`;
      text.append(strong, small);
      const badge = document.createElement('span');
      badge.className = 'pending-sanction-badge';
      badge.textContent = typeLabels[event.event_type] || event.event_type;
      head.append(text, badge);

      const actions = document.createElement('div');
      actions.className = 'pending-sanction-actions';
      const button = document.createElement('button');
      button.className = 'serve-button';
      button.type = 'button';
      button.textContent = 'MARCAR COMO CUMPLIDA';
      button.addEventListener('click', () => serveSanction(event, button));
      actions.appendChild(button);
      card.append(head, actions);
      sanctionsTarget.appendChild(card);
    });
  }

  async function serveSanction(event, button) {
    const license = licenseById.get(event.superlicense_id) || {};
    const driver = license.drivers || {};
    const label = typeLabels[event.event_type] || event.event_type;
    const extra = event.event_type === 'race_ban' ? '\n\nAl cumplir el RACE BAN, si el piloto está a 0 puntos, recuperará 6 puntos automáticamente.' : '';
    if (!window.confirm(`¿Marcar ${label} de ${driver.nickname || 'este piloto'} como cumplida?${extra}`)) return;

    button.disabled = true;
    button.textContent = 'GUARDANDO…';
    const { error } = await client.from('superlicense_events').update({ status: 'served' }).eq('id', event.id).eq('status', 'pending');
    if (error) {
      button.disabled = false;
      button.textContent = 'MARCAR COMO CUMPLIDA';
      window.alert(`No se pudo actualizar la sanción: ${error.message}`);
      return;
    }
    window.setTimeout(() => window.location.reload(), 450);
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    setStatus('');
    const license = selectedLicense();
    if (!license) return setStatus('Selecciona un piloto.', 'error');

    const type = typeSelect.value;
    const amount = Math.max(0, parseInt(pointsInput.value || '0', 10));
    const current = Number(license.current_points || 0);
    const starting = Number(license.starting_points || 12);
    const description = descriptionInput.value.trim();
    const round = roundInput.value ? parseInt(roundInput.value, 10) : null;
    const eventDate = dateInput.value || null;

    if (!eventDate) return setStatus('Selecciona la fecha.', 'error');
    if (round !== null && round < 1) return setStatus('La ronda debe ser mayor que 0.', 'error');
    if (!description) return setStatus('Escribe una descripción de la incidencia.', 'error');
    if ((type === 'points_penalty' || type === 'points_restore') && amount < 1) return setStatus('Indica al menos 1 punto.', 'error');
    if (type === 'points_penalty' && amount > current) return setStatus(`El piloto solo tiene ${current} puntos disponibles.`, 'error');
    if (type === 'points_restore' && amount > (starting - current)) return setStatus(`Solo se pueden recuperar ${starting - current} puntos.`, 'error');

    const delta = type === 'points_penalty' ? -amount : type === 'points_restore' ? amount : 0;
    const driverName = license.drivers?.nickname || 'Piloto';
    const operation = `${typeLabels[type] || type}${delta ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}`;
    if (!window.confirm(`¿Registrar esta incidencia?\n\nPiloto: ${driverName}\nTipo: ${operation}\nRonda: ${round ? `R${round}` : 'sin ronda'}\nFecha: ${formatDate(eventDate)}`)) return;

    submitButton.disabled = true;
    submitButton.querySelector('span').textContent = 'GUARDANDO…';
    const { error } = await client.from('superlicense_events').insert({
      superlicense_id: license.id,
      round_number: round,
      event_date: eventDate,
      event_type: type,
      points_delta: delta,
      article: articleInput.value.trim() || null,
      description,
      status: 'applied',
      created_by: session.user.id
    });
    submitButton.disabled = false;
    submitButton.querySelector('span').textContent = 'REGISTRAR INCIDENCIA';

    if (error) return setStatus(error.message || 'No se pudo registrar la incidencia.', 'error');
    setStatus('Incidencia registrada correctamente. Actualizando Race Control…', 'success');
    window.setTimeout(() => window.location.reload(), 600);
  });

  [licenseSelect, typeSelect, pointsInput].forEach(el => el.addEventListener(el === pointsInput ? 'input' : 'change', () => {
    if (el === typeSelect) syncPointsField();
    else renderPreview();
  }));

  async function init() {
    const { data: { session: activeSession } } = await client.auth.getSession();
    if (!activeSession) return;
    session = activeSession;

    const roles = await client.from('user_roles').select('role').eq('user_id', session.user.id).in('role', ['staff', 'admin']);
    if (roles.error || !(roles.data || []).length) return;

    const licensesResponse = await client
      .from('superlicenses')
      .select('id,driver_id,starting_points,current_points,points_lost_since_rb,is_active,drivers:driver_id(id,nickname,race_number)')
      .eq('season_number', config.currentSeason)
      .eq('is_active', true);
    if (licensesResponse.error) {
      setStatus('No se pudieron cargar las superlicencias.', 'error');
      return;
    }

    licenses = licensesResponse.data || [];
    licenseById = new Map(licenses.map(item => [item.id, item]));
    populateLicenses();
    dateInput.value = new Date().toISOString().slice(0, 10);
    syncPointsField();
    await loadPendingSanctions();
  }

  init();
})();
