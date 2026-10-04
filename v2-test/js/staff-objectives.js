(() => {
  const config = window.HYPERDRIVE_CONFIG;
  if (!config || !window.supabase) return;

  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  let dashboard = null;
  let selectedTeamId = null;
  let mounted = false;

  const money = value => `${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value || 0))} M`;
  const divisionLabel = value => value === 'academy' ? 'ACADEMY' : 'HYPERDRIVE';
  const effectiveReward = (catalogItem, division) => Number(catalogItem?.reward_hyperdrive_m || 0) * (division === 'academy' ? 0.5 : 1);

  function addStyles() {
    if (document.getElementById('staffObjectivesCss')) return;
    const link = document.createElement('link');
    link.id = 'staffObjectivesCss';
    link.rel = 'stylesheet';
    link.href = 'css/staff-objectives.css?v=2';
    document.head.appendChild(link);
  }

  function make(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  function setMessage(text = '', type = '') {
    const el = document.getElementById('staffObjectivesMessage');
    if (!el) return;
    el.textContent = text;
    el.className = `staff-objectives-message${type ? ` ${type}` : ''}`;
  }

  function catalogByNumber() {
    return new Map((dashboard?.catalog || []).map(item => [Number(item.sponsor_number), item]));
  }

  async function loadDashboard() {
    setMessage('Cargando objetivos…');
    const { data, error } = await client.rpc('staff_objectives_dashboard', { p_season_number: config.currentSeason });
    if (error) {
      setMessage(error.message || 'No se pudieron cargar los objetivos.', 'error');
      return false;
    }
    dashboard = data || { teams: [], catalog: [], pending_review_count: 0 };
    renderPendingReviews();
    const badge = document.querySelector('#staffObjectivesHubCard .staff-hub-badge');
    if (badge) {
      const pending = Number(dashboard.pending_review_count || 0);
      badge.textContent = pending ? `${pending} EN REVISIÓN` : 'SIN PENDIENTES';
      badge.classList.toggle('has-pending', pending > 0);
    }
    setMessage('');
    return true;
  }

  function hideRaceControlRegions() {
    const selectors = [
      '.staff-summary-grid',
      '#staffOperations',
      '.filters-panel',
      '.filters-panel + .staff-panel'
    ];
    selectors.forEach(selector => document.querySelectorAll(selector).forEach(el => el.classList.add('staff-nav-hidden')));

    const summary = document.querySelector('.staff-summary-grid');
    summary?.previousElementSibling?.classList.add('staff-nav-hidden');
    const filters = document.querySelector('.filters-panel');
    filters?.previousElementSibling?.classList.add('staff-nav-hidden');
    const eventsBody = document.getElementById('eventsBody');
    const historyPanel = eventsBody?.closest('.staff-panel');
    historyPanel?.classList.add('staff-nav-hidden');
    historyPanel?.previousElementSibling?.classList.add('staff-nav-hidden');
  }

  function showObjectivesRoot() {
    hideRaceControlRegions();
    document.getElementById('staffHub')?.classList.add('staff-nav-hidden');
    document.getElementById('staffSectionBar')?.classList.add('staff-nav-hidden');
    document.getElementById('staffObjectivesRoot')?.classList.remove('staff-objectives-hidden');
  }

  function backToStaffHome() {
    document.getElementById('staffObjectivesRoot')?.classList.add('staff-objectives-hidden');
    document.getElementById('staffSectionBar')?.classList.add('staff-nav-hidden');
    document.getElementById('staffHub')?.classList.remove('staff-nav-hidden');
    selectedTeamId = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showTeamList() {
    selectedTeamId = null;
    document.getElementById('staffObjectivesTeamsView')?.classList.remove('staff-objectives-hidden');
    document.getElementById('staffObjectivesDetailView')?.classList.add('staff-objectives-hidden');
    renderTeams();
  }

  function teamProgress(team) {
    const rows = team.objectives || [];
    return {
      total: rows.length,
      completed: rows.filter(row => row.is_completed).length,
      pending: rows.filter(row => !row.is_completed && row.review_status === 'pending').length
    };
  }

  function pendingReviews() {
    const rows = [];
    (dashboard?.teams || []).forEach(team => {
      (team.objectives || []).forEach(row => {
        if (!row.is_completed && row.review_status === 'pending') rows.push({ team, row });
      });
    });
    return rows.sort((a, b) => new Date(a.row.review_requested_at || 0).getTime() - new Date(b.row.review_requested_at || 0).getTime());
  }

  function renderPendingReviews() {
    const root = document.getElementById('staffObjectivesPending');
    const count = document.getElementById('staffObjectivesPendingCount');
    if (!root || !dashboard) return;
    const pending = pendingReviews();
    if (count) count.textContent = String(pending.length);
    root.textContent = '';

    if (!pending.length) {
      const empty = make('div', 'staff-objectives-pending-empty');
      empty.append(
        make('strong', '', 'No hay objetivos pendientes de revisión.'),
        make('span', '', 'Cuando un Team Principal envíe uno, aparecerá aquí arriba automáticamente al volver a entrar o refrescar la sección.')
      );
      root.appendChild(empty);
      return;
    }

    pending.forEach(({ team, row }) => {
      const card = make('article', 'staff-pending-review-card');
      const main = make('div', 'staff-pending-review-main');
      const eyebrow = make('span', 'staff-pending-review-kicker', (team.team_name || 'Escudería') + ' · ' + divisionLabel(row.division));
      const title = make('strong', 'staff-pending-review-title', '#' + row.sponsor_number + ' · ' + (row.name || 'Objetivo'));
      const description = make('p', 'staff-pending-review-description', row.objective || '—');
      const meta = make('div', 'staff-pending-review-meta');
      meta.append(
        make('span', '', 'Recompensa: ' + money(row.effective_reward_m)),
        make('span', '', row.review_requested_at ? 'Enviado: ' + new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(row.review_requested_at)) : 'En revisión')
      );
      main.append(eyebrow, title, description, meta);

      const actions = make('div', 'staff-pending-review-actions');
      const approve = make('button', 'staff-objective-confirm staff-pending-approve', 'ACEPTAR');
      approve.type = 'button';
      approve.addEventListener('click', () => confirmObjective(team, row, approve));
      const deny = make('button', 'staff-objective-deny staff-pending-deny', 'DENEGAR');
      deny.type = 'button';
      deny.addEventListener('click', () => denyObjective(team, row, deny));
      actions.append(approve, deny);
      card.append(main, actions);
      root.appendChild(card);
    });
  }

  function renderTeams() {
    const grid = document.getElementById('staffObjectivesTeamGrid');
    if (!grid || !dashboard) return;
    grid.textContent = '';
    const teams = [...(dashboard.teams || [])].sort((a, b) => String(a.team_name).localeCompare(String(b.team_name), 'es'));
    teams.forEach(team => {
      const progress = teamProgress(team);
      const button = make('button', 'staff-objectives-team');
      button.type = 'button';
      button.append(
        make('span', '', 'ESCUDERÍA'),
        make('strong', '', team.team_name || 'Escudería'),
        make('small', '', '5 objetivos HyperDrive + 5 objetivos Academy'),
        make('div', `team-progress${progress.pending ? ' has-pending' : ''}`, `${progress.completed}/${progress.total} confirmados${progress.pending ? ` · ${progress.pending} en revisión` : ''}`)
      );
      button.addEventListener('click', () => openTeam(team.team_id));
      grid.appendChild(button);
    });
  }

  function objectiveCard(team, row) {
    const underReview = !row.is_completed && row.review_status === 'pending';
    const card = make('article', `staff-objective-card${row.is_completed ? ' completed' : ''}${underReview ? ' under-review' : ''}`);
    const top = make('div', 'staff-objective-card-top');
    const title = make('div', 'staff-objective-title');
    title.append(make('span', '', `OBJETIVO #${row.sponsor_number}`), make('strong', '', row.name || 'Objetivo'));
    const reward = make('div', 'staff-objective-reward');
    reward.append(make('span', '', 'RECOMPENSA'), make('strong', '', money(row.effective_reward_m)));
    top.append(title, reward);

    const description = make('p', 'staff-objective-description', row.objective || '—');
    const controls = make('div', 'staff-objective-controls');
    const numberWrap = make('div', 'staff-objective-number');
    const label = make('label');
    label.appendChild(make('span', '', 'NÚMERO DE OBJETIVO'));
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.step = '1';
    input.value = String(row.sponsor_number || '');
    input.disabled = !!row.is_completed || underReview;
    label.appendChild(input);
    const change = make('button', 'staff-objective-change', row.is_completed ? 'BLOQUEADO' : underReview ? 'EN REVISIÓN' : 'CAMBIAR');
    change.type = 'button';
    change.disabled = !!row.is_completed || underReview;
    numberWrap.append(label, change);

    const right = make('div');
    if (row.is_completed) {
      const state = make('span', 'staff-objective-state completed', 'CUMPLIDO Y PAGADO');
      right.appendChild(state);
    } else if (underReview) {
      const state = make('span', 'staff-objective-state reviewing', 'EN REVISIÓN');
      const actions = make('div', 'staff-objective-review-actions');
      const approve = make('button', 'staff-objective-confirm', 'ACEPTAR');
      approve.type = 'button';
      approve.addEventListener('click', () => confirmObjective(team, row, approve));

      const deny = make('button', 'staff-objective-deny', 'DENEGAR');
      deny.type = 'button';
      deny.addEventListener('click', () => denyObjective(team, row, deny));

      actions.append(approve, deny);
      right.append(state, actions);
    } else {
      right.appendChild(make('span', 'staff-objective-state idle', 'SIN SOLICITUD'));
    }
    controls.append(numberWrap, right);

    change.addEventListener('click', () => changeObjective(team, row, input, change));
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        change.click();
      }
    });

    card.append(top, description, controls);
    return card;
  }

  function divisionSection(team, division) {
    const section = make('section', 'staff-objectives-division');
    const head = make('div', 'staff-objectives-division-head');
    const rows = (team.objectives || []).filter(row => row.division === division).sort((a, b) => Number(a.sponsor_number) - Number(b.sponsor_number));
    head.append(make('h4', '', divisionLabel(division)), make('span', '', `${rows.length} OBJETIVOS`));
    const list = make('div', 'staff-objectives-list');
    rows.forEach(row => list.appendChild(objectiveCard(team, row)));
    section.append(head, list);
    return section;
  }

  function openTeam(teamId) {
    const team = (dashboard?.teams || []).find(item => item.team_id === teamId);
    if (!team) return;
    selectedTeamId = teamId;
    const teamsView = document.getElementById('staffObjectivesTeamsView');
    const detailView = document.getElementById('staffObjectivesDetailView');
    const content = document.getElementById('staffObjectivesDetailContent');
    const name = document.getElementById('staffObjectivesTeamName');
    const subtitle = document.getElementById('staffObjectivesTeamSubtitle');
    teamsView?.classList.add('staff-objectives-hidden');
    detailView?.classList.remove('staff-objectives-hidden');
    if (name) name.textContent = team.team_name || 'Escudería';
    const progress = teamProgress(team);
    if (subtitle) subtitle.textContent = `${progress.completed}/${progress.total} objetivos confirmados${progress.pending ? ` · ${progress.pending} en revisión` : ''} · Temporada ${config.currentSeason}`;
    if (content) {
      content.textContent = '';
      content.append(divisionSection(team, 'hyperdrive'), divisionSection(team, 'academy'));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function refreshSelected() {
    const current = selectedTeamId;
    if (!await loadDashboard()) return;
    renderPendingReviews();
    renderTeams();
    if (current) openTeam(current);
  }

  async function changeObjective(team, row, input, button) {
    const number = Number(input.value);
    const catalog = catalogByNumber();
    const next = catalog.get(number);
    if (!Number.isInteger(number) || !next) {
      setMessage('Ese número de objetivo no existe en el catálogo de esta temporada.', 'error');
      return;
    }
    if (number === Number(row.sponsor_number)) {
      setMessage('Ese objetivo ya está asignado.', 'error');
      return;
    }
    const reward = effectiveReward(next, row.division);
    const ok = window.confirm(
      `¿Cambiar el objetivo de ${team.team_name}?\n\n${divisionLabel(row.division)}\n#${number} · ${next.name}\n${next.objective}\nRecompensa: ${money(reward)}\n\nEl cambio solo afecta a este objetivo pendiente.`
    );
    if (!ok) return;
    button.disabled = true;
    button.textContent = 'GUARDANDO…';
    const { error } = await client.rpc('staff_change_team_objective', {
      p_team_sponsor_id: row.id,
      p_sponsor_number: number
    });
    button.disabled = false;
    button.textContent = 'CAMBIAR';
    if (error) {
      setMessage(error.message || 'No se pudo cambiar el objetivo.', 'error');
      return;
    }
    setMessage(`Objetivo actualizado para ${team.team_name}.`, 'success');
    await refreshSelected();
  }

  async function confirmObjective(team, row, button) {
    const ok = window.confirm(
      `¿Aceptar este objetivo como cumplido?\n\n${team.team_name} · ${divisionLabel(row.division)}\n#${row.sponsor_number} · ${row.name}\n${row.objective}\n\nSe ingresarán ${money(row.effective_reward_m)} en el banco de la escudería y quedará marcado como CUMPLIDO.`
    );
    if (!ok) return;

    button.disabled = true;
    button.textContent = 'ACEPTANDO…';
    const { data, error } = await client.rpc('staff_confirm_team_objective', {
      p_team_sponsor_id: row.id
    });

    if (error) {
      button.disabled = false;
      button.textContent = 'ACEPTAR';
      setMessage(error.message || 'No se pudo aceptar el objetivo.', 'error');
      return;
    }

    setMessage(`Objetivo aceptado. +${money(data?.amount_m ?? row.effective_reward_m)} ingresados a ${team.team_name}.`, 'success');
    await refreshSelected();
  }

  async function denyObjective(team, row, button) {
    const ok = window.confirm(
      `¿Denegar esta solicitud?\n\n${team.team_name} · ${divisionLabel(row.division)}\n#${row.sponsor_number} · ${row.name}\n\nNo se ingresará dinero. El objetivo volverá a aparecer como SIN CUMPLIR y el Team Principal podrá enviarlo de nuevo más adelante.`
    );
    if (!ok) return;

    button.disabled = true;
    button.textContent = 'DENEGANDO…';
    const { error } = await client.rpc('staff_deny_team_objective_review', {
      p_team_sponsor_id: row.id
    });

    if (error) {
      button.disabled = false;
      button.textContent = 'DENEGAR';
      setMessage(error.message || 'No se pudo denegar la solicitud.', 'error');
      return;
    }

    setMessage(`Solicitud denegada para ${team.team_name}. El objetivo vuelve a quedar disponible para una futura revisión.`, 'success');
    await refreshSelected();
  }

  async function openObjectives() {
    showObjectivesRoot();
    document.getElementById('staffObjectivesTeamsView')?.classList.remove('staff-objectives-hidden');
    document.getElementById('staffObjectivesDetailView')?.classList.add('staff-objectives-hidden');
    if (await loadDashboard()) {
      renderPendingReviews();
      renderTeams();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function mount() {
    if (mounted) return;
    const hub = document.getElementById('staffHub');
    const grid = hub?.querySelector('.staff-hub-grid');
    const content = document.getElementById('staffContent');
    if (!hub || !grid || !content) return;
    mounted = true;
    addStyles();

    const card = make('button', 'staff-hub-card');
    card.id = 'staffObjectivesHubCard';
    card.type = 'button';
    const icon = make('span', 'staff-hub-icon', '✓');
    const kicker = make('span', 'hub-kicker', 'ESCUDERÍAS');
    const title = make('h3', '', 'Objetivos de escudería');
    const copy = make('p', '', 'Revisa las solicitudes enviadas por los Team Principals, acepta o deniega el cumplimiento y gestiona los objetivos asignados.');
    const footer = make('div', 'staff-hub-footer');
    footer.append(make('span', '', 'ABRIR SECCIÓN →'), make('span', 'staff-hub-badge', 'REVISIÓN MANUAL'));
    card.append(icon, kicker, title, copy, footer);
    card.addEventListener('click', openObjectives);
    grid.appendChild(card);

    const root = make('section', 'staff-objectives-root staff-objectives-hidden');
    root.id = 'staffObjectivesRoot';

    const topbar = make('div', 'staff-objectives-topbar');
    const topcopy = make('div');
    topcopy.append(make('span', 'eyebrow', 'STAFF · OBJETIVOS'), make('h2', '', 'Objetivos de escudería'), make('p', '', 'Los Team Principals envían los objetivos que creen cumplidos. Staff los revisa: al aceptar se paga la recompensa; al denegar vuelve a quedar sin cumplir y puede enviarse otra vez más adelante.'));
    const back = make('button', 'staff-objectives-back', '← VOLVER A STAFF');
    back.type = 'button';
    back.addEventListener('click', backToStaffHome);
    topbar.append(topcopy, back);

    const message = make('p', 'staff-objectives-message');
    message.id = 'staffObjectivesMessage';

    const pendingSection = make('section', 'staff-objectives-pending-section');
    const pendingHead = make('div', 'staff-objectives-pending-head');
    const pendingCopy = make('div');
    pendingCopy.append(
      make('span', 'panel-label', 'PRIORIDAD STAFF'),
      make('h3', '', 'Revisiones pendientes'),
      make('p', '', 'Solicitudes enviadas por los Team Principals. Revísalas antes de entrar al detalle de cada escudería.')
    );
    const pendingBadge = make('span', 'staff-objectives-pending-count', '0');
    pendingBadge.id = 'staffObjectivesPendingCount';
    pendingHead.append(pendingCopy, pendingBadge);
    const pendingList = make('div', 'staff-objectives-pending-list');
    pendingList.id = 'staffObjectivesPending';
    pendingSection.append(pendingHead, pendingList);

    const teamsView = make('div');
    teamsView.id = 'staffObjectivesTeamsView';
    const teamsHead = make('div', 'staff-objectives-detail-head');
    const teamsCopy = make('div');
    teamsCopy.append(make('span', 'panel-label', 'TEMPORADA 8'), make('h3', '', 'Selecciona una escudería'), make('p', '', 'Cada escudería tiene 5 objetivos de HyperDrive y 5 de Academy.'));
    teamsHead.appendChild(teamsCopy);
    const teamGrid = make('div', 'staff-objectives-team-grid');
    teamGrid.id = 'staffObjectivesTeamGrid';
    teamsView.append(teamsHead, teamGrid);

    const detailView = make('div', 'staff-objectives-hidden');
    detailView.id = 'staffObjectivesDetailView';
    const detailHead = make('div', 'staff-objectives-detail-head');
    const detailCopy = make('div');
    detailCopy.append(make('span', 'panel-label', 'OBJETIVOS ASIGNADOS'));
    const teamName = make('h3', '', 'Escudería');
    teamName.id = 'staffObjectivesTeamName';
    const teamSubtitle = make('p', '', '—');
    teamSubtitle.id = 'staffObjectivesTeamSubtitle';
    detailCopy.append(teamName, teamSubtitle);
    const subBack = make('button', 'staff-objectives-subback', '← 11 ESCUDERÍAS');
    subBack.type = 'button';
    subBack.addEventListener('click', showTeamList);
    detailHead.append(detailCopy, subBack);
    const detailContent = make('div');
    detailContent.id = 'staffObjectivesDetailContent';
    detailView.append(detailHead, detailContent);

    root.append(topbar, message, pendingSection, teamsView, detailView);
    hub.insertAdjacentElement('afterend', root);
  }

  const observer = new MutationObserver(() => {
    if (!mounted) mount();
    if (mounted) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  mount();
})();