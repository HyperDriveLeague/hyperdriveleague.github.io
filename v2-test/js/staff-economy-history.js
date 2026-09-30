(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const body = document.getElementById('economyHistoryBody');
  const editBox = document.getElementById('economyEditBox');
  if (!config || !window.supabase || !body || !editBox) return;

  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const message = document.getElementById('economyHistoryMessage');
  const form = document.getElementById('economyEditForm');
  const typeLabel = document.getElementById('economyEditTypeLabel');
  const driverField = document.getElementById('economyEditDriverField');
  const driverSelect = document.getElementById('economyEditDriver');
  const teamSelect = document.getElementById('economyEditTeam');
  const directionField = document.getElementById('economyEditDirectionField');
  const directionSelect = document.getElementById('economyEditDirection');
  const amountInput = document.getElementById('economyEditAmount');
  const roundInput = document.getElementById('economyEditRound');
  const dateInput = document.getElementById('economyEditDate');
  const descriptionInput = document.getElementById('economyEditDescription');
  const saveButton = document.getElementById('economyEditSave');
  const cancelButton = document.getElementById('economyEditCancel');

  let session = null;
  let entries = [];
  let teams = [];
  let drivers = [];
  let roster = [];
  let editing = null;

  const setMessage = (text = '', type = '') => {
    message.textContent = text;
    message.className = `economy-history-message${type ? ` ${type}` : ''}`;
  };

  const formatDate = value => value ? new Intl.DateTimeFormat('es-ES').format(new Date(`${value}T12:00:00`)) : '—';
  const money = value => `${Number(value || 0).toFixed(2).replace('.', ',')} M`;

  function activeOfficialTeam(driverId, roundValue) {
    const round = Number(roundValue || 0);
    const rows = roster.filter(row => row.driver_id === driverId && row.roster_status === 'official');
    if (round > 0) {
      return rows.filter(row => Number(row.start_round || 1) <= round && (row.end_round == null || Number(row.end_round) >= round))
        .sort((a,b) => Number(b.start_round || 1) - Number(a.start_round || 1))[0]?.team_id || null;
    }
    return rows.find(row => row.is_active)?.team_id || null;
  }

  function fillSelect(select, items, blank, getText) {
    select.innerHTML = '';
    const option = document.createElement('option');
    option.value = '';
    option.textContent = blank;
    select.appendChild(option);
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = getText(item);
      select.appendChild(opt);
    });
  }

  function syncFineTeam() {
    if (!editing || editing.kind !== 'fine') return;
    const official = activeOfficialTeam(driverSelect.value, roundInput.value);
    if (official) {
      teamSelect.value = official;
      teamSelect.disabled = true;
    } else {
      teamSelect.disabled = false;
    }
  }

  function closeEdit() {
    editing = null;
    form.reset();
    teamSelect.disabled = false;
    editBox.classList.add('is-hidden');
    setMessage('');
  }

  function openEdit(entry) {
    editing = entry;
    editBox.classList.remove('is-hidden');
    typeLabel.textContent = entry.kind === 'fine' ? 'MULTA' : 'MOVIMIENTO MANUAL';
    driverField.classList.toggle('economy-driver-hidden', entry.kind !== 'fine');
    directionField.classList.toggle('economy-driver-hidden', entry.kind !== 'manual');
    driverSelect.required = entry.kind === 'fine';
    driverSelect.value = entry.driver_id || '';
    teamSelect.disabled = false;
    teamSelect.value = entry.team_id || '';
    directionSelect.value = entry.direction || 'expense';
    amountInput.value = Number(entry.amount_m || 0).toFixed(2);
    roundInput.value = entry.round_number ?? '';
    dateInput.value = entry.date || '';
    descriptionInput.value = entry.description || '';
    if (entry.kind === 'fine') syncFineTeam();
    setMessage('Editando este movimiento. Al guardar se actualizará también el movimiento bancario asociado.');
    editBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function removeEntry(entry, buttons) {
    const label = entry.kind === 'fine' ? 'esta multa' : 'este movimiento manual';
    if (!window.confirm(`¿Eliminar ${label}?\n\nSe eliminará también su movimiento económico asociado. Los movimientos importados y las sanciones deportivas no se tocarán.`)) return;
    buttons.forEach(button => button.disabled = true);
    const rpc = entry.kind === 'fine' ? 'staff_delete_team_fine' : 'staff_delete_manual_team_movement';
    const args = entry.kind === 'fine' ? { p_fine_id: entry.id } : { p_movement_id: entry.id };
    const { error } = await client.rpc(rpc, args);
    if (error) {
      buttons.forEach(button => button.disabled = false);
      window.alert(error.message || 'No se pudo eliminar el movimiento.');
      return;
    }
    window.location.reload();
  }

  function render() {
    body.innerHTML = '';
    const sorted = [...entries].sort((a,b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0));
    if (!sorted.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 8;
      td.className = 'economy-history-empty';
      td.textContent = 'Todavía no hay multas ni movimientos manuales creados desde Race Control.';
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }

    sorted.forEach(entry => {
      const tr = document.createElement('tr');
      const values = [
        formatDate(entry.date),
        entry.round_number ? `R${entry.round_number}` : '—',
        entry.kind === 'fine' ? (entry.driver_name || 'Piloto') : '—',
        entry.team_name || '—',
        entry.description || '—'
      ];

      const kindTd = document.createElement('td');
      const kind = document.createElement('span');
      kind.className = `economy-history-kind ${entry.kind}`;
      kind.textContent = entry.kind === 'fine' ? 'MULTA' : 'MANUAL';
      kindTd.appendChild(kind);
      tr.appendChild(kindTd);

      values.forEach((value, index) => {
        const td = document.createElement('td');
        td.textContent = value;
        if (index === 2 || index === 3) {
          const strong = document.createElement('strong');
          strong.textContent = value;
          td.textContent = '';
          td.appendChild(strong);
        }
        tr.appendChild(td);
      });

      const amountTd = document.createElement('td');
      const isIncome = entry.direction === 'income';
      amountTd.className = `economy-money ${isIncome ? 'income' : 'expense'}`;
      amountTd.textContent = `${isIncome ? '+' : '-'}${money(entry.amount_m)}`;
      tr.appendChild(amountTd);

      const actionsTd = document.createElement('td');
      const actions = document.createElement('div');
      actions.className = 'economy-actions';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'economy-action edit';
      edit.textContent = 'EDITAR';
      edit.addEventListener('click', () => openEdit(entry));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'economy-action delete';
      remove.textContent = 'ELIMINAR';
      remove.addEventListener('click', () => removeEntry(entry, [edit, remove]));
      actions.append(edit, remove);
      actionsTd.appendChild(actions);
      tr.appendChild(actionsTd);
      body.appendChild(tr);
    });
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!editing) return;
    const amount = Number(amountInput.value || 0);
    if (!(amount > 0)) return setMessage('El importe debe ser mayor que 0.', 'error');
    if (!teamSelect.value) return setMessage('Selecciona una escudería.', 'error');
    if (!dateInput.value) return setMessage('Selecciona una fecha.', 'error');
    if (!descriptionInput.value.trim()) return setMessage('Escribe una descripción.', 'error');

    let rpc;
    let args;
    if (editing.kind === 'fine') {
      if (!driverSelect.value) return setMessage('Selecciona un piloto.', 'error');
      rpc = 'staff_edit_team_fine';
      args = {
        p_fine_id: editing.id,
        p_driver_id: driverSelect.value,
        p_team_id: teamSelect.value,
        p_description: descriptionInput.value.trim(),
        p_amount_m: amount,
        p_round_number: roundInput.value ? Number(roundInput.value) : null,
        p_fine_date: dateInput.value,
        p_season_number: config.currentSeason
      };
    } else {
      rpc = 'staff_edit_manual_team_movement';
      args = {
        p_movement_id: editing.id,
        p_team_id: teamSelect.value,
        p_description: descriptionInput.value.trim(),
        p_direction: directionSelect.value,
        p_amount_m: amount,
        p_round_number: roundInput.value ? Number(roundInput.value) : null,
        p_transaction_date: dateInput.value,
        p_season_number: config.currentSeason
      };
    }

    const label = editing.kind === 'fine' ? 'multa' : 'movimiento manual';
    if (!window.confirm(`¿Guardar cambios en esta ${label}?\n\nEl movimiento económico existente se actualizará con los nuevos datos.`)) return;
    saveButton.disabled = true;
    saveButton.querySelector('span').textContent = 'GUARDANDO…';
    const { error } = await client.rpc(rpc, args);
    saveButton.disabled = false;
    saveButton.querySelector('span').textContent = 'GUARDAR CAMBIOS';
    if (error) return setMessage(error.message || 'No se pudieron guardar los cambios.', 'error');
    setMessage('Cambios guardados correctamente.', 'success');
    window.setTimeout(() => window.location.reload(), 500);
  });

  cancelButton.addEventListener('click', closeEdit);
  driverSelect.addEventListener('change', syncFineTeam);
  roundInput.addEventListener('input', syncFineTeam);

  async function init() {
    const { data: { session: activeSession } } = await client.auth.getSession();
    if (!activeSession) return;
    session = activeSession;
    const roles = await client.from('user_roles').select('role').eq('user_id', session.user.id).in('role', ['staff','admin']);
    if (roles.error || !(roles.data || []).length) return;

    const [fines, manuals, teamsResponse, driversResponse, rosterResponse] = await Promise.all([
      client.from('staff_team_fines').select('id,season_number,round_number,fine_date,driver_id,team_id,description,amount_m,transaction_id,created_at,drivers:driver_id(id,nickname,race_number),teams:team_id(id,name)').eq('season_number', config.currentSeason),
      client.from('staff_manual_movements').select('id,season_number,round_number,movement_date,team_id,description,direction,amount_m,transaction_id,created_at,teams:team_id(id,name)').eq('season_number', config.currentSeason),
      client.from('teams').select('id,name').eq('is_active', true).order('name'),
      client.from('drivers').select('id,nickname,race_number').eq('is_active', true).order('nickname'),
      client.from('season_roster').select('driver_id,team_id,roster_status,start_round,end_round,is_active').eq('season_number', config.currentSeason)
    ]);

    if (fines.error || manuals.error || teamsResponse.error || driversResponse.error || rosterResponse.error) {
      setMessage('No se pudo cargar el histórico económico de Race Control.', 'error');
      return;
    }

    teams = teamsResponse.data || [];
    drivers = driversResponse.data || [];
    roster = rosterResponse.data || [];
    fillSelect(teamSelect, teams, 'Selecciona escudería', item => item.name);
    fillSelect(driverSelect, drivers, 'Selecciona piloto', item => `#${item.race_number ?? '--'} · ${item.nickname}`);

    entries = [
      ...(fines.data || []).map(item => ({
        kind: 'fine', id: item.id, date: item.fine_date, round_number: item.round_number,
        driver_id: item.driver_id, driver_name: item.drivers?.nickname || 'Piloto', team_id: item.team_id,
        team_name: item.teams?.name || '—', description: item.description, amount_m: item.amount_m,
        direction: 'expense', created_at: item.created_at
      })),
      ...(manuals.data || []).map(item => ({
        kind: 'manual', id: item.id, date: item.movement_date, round_number: item.round_number,
        driver_id: null, driver_name: null, team_id: item.team_id, team_name: item.teams?.name || '—',
        description: item.description, amount_m: item.amount_m, direction: item.direction, created_at: item.created_at
      }))
    ];
    render();
  }

  init();
})();