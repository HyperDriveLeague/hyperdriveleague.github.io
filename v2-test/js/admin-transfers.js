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

  function directionText(item) {
    return item.direction === 'driver_to_team'
      ? '#' + (item.driver_number ?? '--') + ' ' + item.driver_name + ' → ' + item.team_name
      : item.team_name + ' → #' + (item.driver_number ?? '--') + ' ' + item.driver_name;
  }

  function historyRow(item) {
    const row = document.createElement('div');
    row.className = 'transfer-row';
    const top = document.createElement('div');
    top.className = 'transfer-row-top';
    const title = document.createElement('strong');
    title.textContent = directionText(item);
    const state = document.createElement('span');
    state.className = 'status-' + item.status;
    state.textContent = statusLabel(item.status);
    top.append(title, state);

    const meta = document.createElement('p');
    meta.textContent = money(item.amount_m) + ' M · ' + dateTime(item.requested_at)
      + (item.note ? ' · ' + item.note : '')
      + (item.review_note ? ' · Revisión: ' + item.review_note : '');
    row.append(top, meta);
    return row;
  }

  async function review(id, decision, note, row) {
    row.querySelectorAll('button').forEach(button => { button.disabled = true; });
    const response = await client.rpc('admin_review_driver_team_transfer', {
      p_request_id: id,
      p_decision: decision,
      p_review_note: note || null
    });
    if (response.error) {
      console.error(response.error);
      row.querySelectorAll('button').forEach(button => { button.disabled = false; });
      window.alert(response.error.message || 'No se pudo revisar la transferencia.');
      return;
    }
    await load();
  }

  function renderPending(items) {
    const target = $('pendingList');
    target.innerHTML = '';
    $('pendingCount').textContent = items.length;
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'transfer-empty';
      empty.textContent = 'No hay transferencias pendientes.';
      target.appendChild(empty);
      return;
    }

    items.forEach(item => {
      const row = historyRow(item);
      const actions = document.createElement('div');
      actions.className = 'transfer-row-actions';
      const note = document.createElement('input');
      note.className = 'review-note';
      note.maxLength = 180;
      note.placeholder = 'Nota de revisión · opcional';

      const approve = document.createElement('button');
      approve.type = 'button';
      approve.className = 'approve-button';
      approve.textContent = 'APROBAR';
      approve.addEventListener('click', () => review(item.id, 'approve', note.value.trim(), row));

      const reject = document.createElement('button');
      reject.type = 'button';
      reject.className = 'reject-button';
      reject.textContent = 'RECHAZAR';
      reject.addEventListener('click', () => review(item.id, 'reject', note.value.trim(), row));

      actions.append(note, approve, reject);
      row.appendChild(actions);
      target.appendChild(row);
    });
  }

  function renderHistory(items) {
    const target = $('historyList');
    target.innerHTML = '';
    const reviewed = items.filter(item => item.status !== 'pending');
    if (!reviewed.length) {
      const empty = document.createElement('div');
      empty.className = 'transfer-empty';
      empty.textContent = 'Todavía no hay solicitudes revisadas.';
      target.appendChild(empty);
      return;
    }
    reviewed.slice(0, 100).forEach(item => target.appendChild(historyRow(item)));
  }

  async function load() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) return window.location.replace('index.html');

    const [pendingResponse, allResponse] = await Promise.all([
      client.rpc('admin_transfer_requests', { p_status: 'pending' }),
      client.rpc('admin_transfer_requests', { p_status: 'all' })
    ]);

    const failed = [pendingResponse, allResponse].find(r => r.error);
    if (failed) {
      console.error(failed.error);
      return showError(failed.error?.message || 'No se pudieron cargar las transferencias.');
    }

    renderPending(pendingResponse.data || []);
    renderHistory(allResponse.data || []);

    $('loadingPanel').classList.add('is-hidden');
    $('errorPanel').classList.add('is-hidden');
    $('transferContent').classList.remove('is-hidden');
  }

  $('logoutButton').addEventListener('click', async () => {
    await client.auth.signOut();
    window.location.replace('index.html');
  });

  load();
})();