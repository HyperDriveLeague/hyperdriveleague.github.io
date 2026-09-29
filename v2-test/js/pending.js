(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const authView = document.getElementById('authView');
  const dashboardView = document.getElementById('dashboardView');
  const pilotView = document.getElementById('pilotView');
  const pendingView = document.getElementById('pendingView');
  const pendingDiscord = document.getElementById('pendingDiscord');
  const pendingEmail = document.getElementById('pendingEmail');
  const pendingLogoutButton = document.getElementById('pendingLogoutButton');
  if (!pendingView || !pendingLogoutButton) return;

  let isPending = false;

  function showPending() {
    if (!isPending) return;
    authView?.classList.add('is-hidden');
    dashboardView?.classList.add('is-hidden');
    pilotView?.classList.add('is-hidden');
    pendingView.classList.remove('is-hidden');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function hidePending() {
    isPending = false;
    pendingView.classList.add('is-hidden');
  }

  async function checkPending(session) {
    if (!session?.user) return hidePending();

    const rolesResponse = await client.from('user_roles').select('role').eq('user_id', session.user.id);
    if (rolesResponse.error || (rolesResponse.data || []).length) return hidePending();

    const profileResponse = await client.from('profiles').select('display_name, discord_username').eq('id', session.user.id).maybeSingle();
    if (profileResponse.error) return;

    isPending = true;
    const profile = profileResponse.data;
    pendingDiscord.textContent = profile?.discord_username || profile?.display_name || 'No indicado';
    pendingEmail.textContent = session.user.email || '—';
    showPending();
  }

  pendingLogoutButton.addEventListener('click', async () => {
    pendingLogoutButton.disabled = true;
    await client.auth.signOut();
    pendingLogoutButton.disabled = false;
    hidePending();
  });

  const observer = new MutationObserver(() => {
    if (isPending && dashboardView && !dashboardView.classList.contains('is-hidden')) showPending();
  });
  if (dashboardView) observer.observe(dashboardView, { attributes: true, attributeFilter: ['class'] });

  client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) return hidePending();
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') window.setTimeout(() => checkPending(session), 120);
  });

  (async () => {
    const { data: { session } } = await client.auth.getSession();
    if (session) window.setTimeout(() => checkPending(session), 120);
  })();
})();