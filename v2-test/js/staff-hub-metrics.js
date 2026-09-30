(() => {
  const config = window.HYPERDRIVE_CONFIG;
  if (!config || !window.supabase) return;

  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function setCardBadge(section, text) {
    const card = document.querySelector(`[data-staff-section="${section}"]`);
    const badge = card?.querySelector('.staff-hub-badge');
    if (badge) badge.textContent = text;
  }

  async function loadMetrics() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) return;

    const [sanctions, fines, manual] = await Promise.all([
      client.from('staff_sporting_sanctions').select('id', { count: 'exact', head: true }).eq('season_number', config.currentSeason),
      client.from('staff_team_fines').select('id', { count: 'exact', head: true }).eq('season_number', config.currentSeason),
      client.from('staff_manual_movements').select('id', { count: 'exact', head: true }).eq('season_number', config.currentSeason)
    ]);

    if (!sanctions.error) {
      const n = sanctions.count || 0;
      setCardBadge('sanctions', plural(n, 'sanción', 'sanciones'));
    }

    if (!fines.error && !manual.error) {
      const n = (fines.count || 0) + (manual.count || 0);
      setCardBadge('economy', plural(n, 'movimiento', 'movimientos'));
    }
  }

  function startWhenHubExists() {
    if (document.getElementById('staffHub')) {
      loadMetrics();
      return;
    }
    const observer = new MutationObserver(() => {
      if (!document.getElementById('staffHub')) return;
      observer.disconnect();
      loadMetrics();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  startWhenHubExists();
})();