(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const pilotView = document.getElementById('pilotView');
  if (!config || !pilotView || !window.supabase) return;

  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  let loading = false;
  let queued = false;

  const money = value => `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(Number(value || 0))} M`;

  function render(items) {
    const target = document.getElementById('pilotObjectives');
    if (!target) return;
    target.textContent = '';
    const marker = document.createElement('span');
    marker.hidden = true;
    marker.dataset.officialObjectivesRender = '1';
    target.appendChild(marker);

    if (!Array.isArray(items) || !items.length) {
      const empty = document.createElement('div');
      empty.className = 'pilot-dashboard-empty';
      empty.textContent = 'No hay objetivos activos para esta división.';
      target.appendChild(empty);
      return;
    }

    items.forEach(item => {
      const completed = !!item.is_completed;
      const card = document.createElement('article');
      card.className = `pilot-objective-card ${completed ? 'completed' : 'pending'}`;

      const top = document.createElement('div');
      top.className = 'pilot-objective-top';
      const copy = document.createElement('div');
      const label = document.createElement('span');
      label.textContent = `#${item.sponsor_number} · ${item.name || 'Objetivo'}`;
      const reward = document.createElement('strong');
      reward.textContent = money(item.effective_reward_m);
      copy.append(label, reward);

      const state = document.createElement('span');
      state.className = 'pilot-objective-state';
      state.textContent = completed ? 'CUMPLIDO' : 'PENDIENTE';
      top.append(copy, state);

      const description = document.createElement('p');
      description.textContent = item.objective || '—';
      const note = document.createElement('small');
      note.textContent = completed
        ? 'Confirmado oficialmente por Race Control.'
        : 'Pendiente de confirmación por Race Control.';

      card.append(top, description, note);
      target.appendChild(card);
    });
  }

  async function applyOfficialStatus() {
    const target = document.getElementById('pilotObjectives');
    if (!target || pilotView.classList.contains('is-hidden')) return;
    if (target.querySelector('[data-official-objectives-render]')) return;
    if (loading) {
      queued = true;
      return;
    }
    loading = true;
    const { data, error } = await client.rpc('pilot_dashboard_private', { p_season_number: config.currentSeason });
    loading = false;
    if (!error) render(data?.objectives || []);
    if (queued) {
      queued = false;
      window.setTimeout(applyOfficialStatus, 20);
    }
  }

  let timer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = window.setTimeout(applyOfficialStatus, 60);
  });
  observer.observe(pilotView, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  if (!pilotView.classList.contains('is-hidden')) window.setTimeout(applyOfficialStatus, 100);
})();