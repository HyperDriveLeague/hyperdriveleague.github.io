(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const adminContent = document.getElementById('adminContent');
  if (!config || !adminContent || !window.supabase) return;

  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const style = document.createElement('style');
  style.textContent = `
    .admin-team-preview-panel{margin-top:12px;padding:20px;border:1px solid rgba(255,255,255,.08);border-radius:15px;background:rgba(255,255,255,.025)}
    .admin-team-preview-note{margin:0 0 16px;color:#8e9299;font-size:11px;line-height:1.6;max-width:850px}
    .admin-team-preview-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .admin-team-preview-card{min-height:125px;display:flex;flex-direction:column;padding:17px;border:1px solid rgba(255,255,255,.09);border-radius:13px;background:#0d0f13;color:#fff;text-decoration:none;transition:transform .18s ease,border-color .18s ease,background .18s ease}
    .admin-team-preview-card:hover{transform:translateY(-2px);border-color:rgba(255,213,0,.42);background:#111318}
    .admin-team-preview-card span{color:var(--yellow);font-size:8px;font-weight:900;letter-spacing:.1em}
    .admin-team-preview-card strong{margin-top:7px;font-size:18px;line-height:1.1}
    .admin-team-preview-card small{margin-top:auto;padding-top:16px;color:#898d94;font-size:9px;font-weight:800;letter-spacing:.04em}
    .admin-team-preview-card:hover small{color:var(--yellow)}
    .admin-team-preview-empty{padding:18px;color:#8a8e95;font-size:11px}
    @media(max-width:900px){.admin-team-preview-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:600px){.admin-team-preview-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function make(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  function mount() {
    if (document.getElementById('adminTeamPreview')) return document.getElementById('adminTeamPreview');

    const roleDistribution = document.getElementById('roleDistribution');
    const roleHeading = roleDistribution?.previousElementSibling || null;
    if (!roleDistribution) return null;

    const heading = document.createElement('section');
    heading.className = 'module-section-heading';
    heading.id = 'adminTeamPreviewHeading';
    const headingCopy = document.createElement('div');
    headingCopy.append(make('span', 'eyebrow', 'COMPROBACIÓN'), make('h2', '', 'Vista de Team Principal'));
    heading.append(headingCopy, make('span', 'season-badge', 'SOLO ADMIN'));

    const panel = document.createElement('section');
    panel.className = 'admin-team-preview-panel';
    panel.id = 'adminTeamPreview';
    panel.appendChild(make('p', 'admin-team-preview-note', 'Selecciona una escudería para abrir exactamente el panel que vería su Team Principal. Esta vista es de comprobación y no cambia tus roles ni los del jefe de equipo.'));
    const grid = make('div', 'admin-team-preview-grid');
    grid.id = 'adminTeamPreviewGrid';
    grid.appendChild(make('div', 'admin-team-preview-empty', 'Cargando escuderías…'));
    panel.appendChild(grid);

    if (roleHeading) roleHeading.insertAdjacentElement('beforebegin', heading);
    else roleDistribution.insertAdjacentElement('beforebegin', heading);
    heading.insertAdjacentElement('afterend', panel);
    return panel;
  }

  async function load() {
    const panel = mount();
    if (!panel) return;
    const grid = document.getElementById('adminTeamPreviewGrid');

    const { data: { session } } = await client.auth.getSession();
    if (!session) return;

    const roleResponse = await client.from('user_roles')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('role', 'admin')
      .limit(1);
    if (roleResponse.error || !(roleResponse.data || []).length) {
      panel.remove();
      document.getElementById('adminTeamPreviewHeading')?.remove();
      return;
    }

    const { data, error } = await client.from('team_accounts')
      .select('team_id,season_number,is_active,teams:team_id(id,name,slug,is_active)')
      .eq('season_number', config.currentSeason)
      .eq('is_active', true);

    grid.textContent = '';
    if (error) {
      grid.appendChild(make('div', 'admin-team-preview-empty', 'No se pudieron cargar las escuderías.'));
      return;
    }

    const teams = (data || [])
      .filter(item => item.teams?.is_active !== false)
      .sort((a, b) => String(a.teams?.name || '').localeCompare(String(b.teams?.name || ''), 'es'));

    if (!teams.length) {
      grid.appendChild(make('div', 'admin-team-preview-empty', 'No hay escuderías activas en esta temporada.'));
      return;
    }

    teams.forEach(item => {
      const link = document.createElement('a');
      link.className = 'admin-team-preview-card';
      link.href = `team.html?preview_team=${encodeURIComponent(item.team_id)}`;
      link.append(
        make('span', '', 'VISTA TEAM PRINCIPAL'),
        make('strong', '', item.teams?.name || 'Escudería'),
        make('small', '', 'ABRIR PANEL →')
      );
      grid.appendChild(link);
    });
  }

  const observer = new MutationObserver(() => {
    if (!document.getElementById('adminTeamPreview')) load();
  });
  observer.observe(adminContent, { attributes: true, attributeFilter: ['class'] });
  load();
})();