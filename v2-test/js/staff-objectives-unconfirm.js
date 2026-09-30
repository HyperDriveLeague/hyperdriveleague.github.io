(() => {
  const config = window.HYPERDRIVE_CONFIG;
  if (!config || !window.supabase) return;

  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  let decorating = false;
  let timer = null;

  function addStyles() {
    if (document.getElementById('staffObjectiveUnconfirmStyles')) return;
    const style = document.createElement('style');
    style.id = 'staffObjectiveUnconfirmStyles';
    style.textContent = `
      .staff-objective-completed-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      .staff-objective-unconfirm{border:1px solid rgba(255,95,95,.35);background:rgba(255,70,70,.07);color:#ff8a8a;border-radius:8px;padding:9px 11px;font:inherit;font-size:9px;font-weight:900;cursor:pointer}
      .staff-objective-unconfirm:hover{border-color:rgba(255,95,95,.7);background:rgba(255,70,70,.12)}
      .staff-objective-unconfirm:disabled{opacity:.45;cursor:not-allowed}
      @media(max-width:700px){.staff-objective-completed-actions{align-items:stretch;flex-direction:column}.staff-objective-unconfirm{width:100%}}
    `;
    document.head.appendChild(style);
  }

  const divisionFromSection = section => {
    const label = section?.querySelector('.staff-objectives-division-head h4')?.textContent?.trim().toLowerCase();
    return label === 'academy' ? 'academy' : label === 'hyperdrive' ? 'hyperdrive' : null;
  };

  const objectiveNumberFromCard = card => {
    const text = card?.querySelector('.staff-objective-title span')?.textContent || '';
    const match = text.match(/#(\d+)/);
    return match ? Number(match[1]) : null;
  };

  function setMessage(text, type = '') {
    const el = document.getElementById('staffObjectivesMessage');
    if (!el) return;
    el.textContent = text;
    el.className = `staff-objectives-message${type ? ` ${type}` : ''}`;
  }

  async function unconfirm(team, row, button) {
    const ok = window.confirm(
      `¿Desmarcar este objetivo como cumplido?\n\n${team.team_name} · ${row.division === 'academy' ? 'ACADEMY' : 'HYPERDRIVE'}\n#${row.sponsor_number} · ${row.name}\n\nSe revertirá el ingreso de ${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(Number(row.effective_reward_m || 0))} M del banco de la escudería.\n\nEl movimiento original y su reversión quedarán registrados en el histórico.`
    );
    if (!ok) return;

    button.disabled = true;
    button.textContent = 'DESMARCANDO…';
    const { data, error } = await client.rpc('staff_unconfirm_team_objective', {
      p_team_sponsor_id: row.id
    });

    if (error) {
      button.disabled = false;
      button.textContent = 'DESMARCAR CUMPLIMIENTO';
      setMessage(error.message || 'No se pudo desmarcar el objetivo.', 'error');
      return;
    }

    setMessage(
      `Objetivo desmarcado. Se han revertido ${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(Number(data?.amount_m ?? row.effective_reward_m ?? 0))} M del banco de ${team.team_name}.`,
      'success'
    );
    sessionStorage.setItem('hyperdriveObjectivesReturnTeam', team.team_name || '');
    window.setTimeout(() => window.location.reload(), 450);
  }

  async function decorate() {
    if (decorating) return;
    const missing = [...document.querySelectorAll('.staff-objective-card.completed')]
      .filter(card => !card.querySelector('.staff-objective-unconfirm'));
    if (!missing.length) return;

    const teamName = document.getElementById('staffObjectivesTeamName')?.textContent?.trim();
    if (!teamName || teamName === 'Escudería') return;

    decorating = true;
    const { data, error } = await client.rpc('staff_objectives_dashboard', {
      p_season_number: config.currentSeason
    });
    decorating = false;
    if (error) return;

    const team = (data?.teams || []).find(item => String(item.team_name || '').trim() === teamName);
    if (!team) return;

    missing.forEach(card => {
      const division = divisionFromSection(card.closest('.staff-objectives-division'));
      const sponsorNumber = objectiveNumberFromCard(card);
      const row = (team.objectives || []).find(item =>
        item.division === division && Number(item.sponsor_number) === sponsorNumber && item.is_completed
      );
      if (!row) return;

      const right = card.querySelector('.staff-objective-controls > div:last-child');
      if (!right) return;
      right.classList.add('staff-objective-completed-actions');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'staff-objective-unconfirm';
      button.textContent = 'DESMARCAR CUMPLIMIENTO';
      button.addEventListener('click', () => unconfirm(team, row, button));
      right.appendChild(button);
    });
  }

  function scheduleDecorate() {
    clearTimeout(timer);
    timer = window.setTimeout(decorate, 80);
  }

  function restoreAfterReload(attempt = 0) {
    const teamName = sessionStorage.getItem('hyperdriveObjectivesReturnTeam');
    if (!teamName) return;
    const hubCard = document.getElementById('staffObjectivesHubCard');
    if (!hubCard) {
      if (attempt < 30) window.setTimeout(() => restoreAfterReload(attempt + 1), 120);
      return;
    }
    if (!document.getElementById('staffObjectivesRoot') || document.getElementById('staffObjectivesRoot').classList.contains('staff-objectives-hidden')) {
      hubCard.click();
    }
    const buttons = [...document.querySelectorAll('.staff-objectives-team')];
    const target = buttons.find(button => button.querySelector('strong')?.textContent?.trim() === teamName);
    if (target) {
      sessionStorage.removeItem('hyperdriveObjectivesReturnTeam');
      target.click();
      return;
    }
    if (attempt < 30) window.setTimeout(() => restoreAfterReload(attempt + 1), 120);
  }

  addStyles();
  new MutationObserver(scheduleDecorate).observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(scheduleDecorate, 150);
  window.setTimeout(() => restoreAfterReload(), 180);
})();