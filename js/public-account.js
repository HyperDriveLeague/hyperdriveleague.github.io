(() => {
  const SUPABASE_URL = 'https://knyxattsjimsjefydcad.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_hLAzZZF6kki1xZ0Kyx6lfA_97kzSAmf';
  const LOGIN_URL = 'login.html';
  const PRIVATE_URL = 'v2-test/index.html';

  function loadHomepageEditorialNews() {
    const path = window.location.pathname.split('/').pop().toLowerCase();
    if (path && path !== 'index.html') return;
    if (!document.getElementById('news-grid')) return;

    if (!document.querySelector('link[data-home-news-editorial]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'css/home-news-editorial.css?v=1';
      link.dataset.homeNewsEditorial = '1';
      document.head.appendChild(link);
    }

    if (!document.querySelector('script[data-home-news-editorial]')) {
      const script = document.createElement('script');
      script.src = 'js/home-news-editorial.js?v=1';
      script.async = true;
      script.dataset.homeNewsEditorial = '1';
      document.body.appendChild(script);
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    .public-account-desktop{display:flex;align-items:center;margin-left:10px;flex-shrink:0}
    .public-account-link{height:44px;display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:0 13px;border:1px solid rgba(255,255,255,.14);border-radius:3px;background:rgba(255,255,255,.035);color:#fff;text-decoration:none;font-size:10px;font-weight:900;letter-spacing:.65px;white-space:nowrap;transition:border-color .2s ease,color .2s ease,background .2s ease,transform .2s ease}
    .public-account-link:hover{border-color:rgba(255,213,0,.6);color:#ffd500;background:rgba(255,213,0,.05);transform:translateY(-1px)}
    .public-account-avatar{width:29px;height:29px;border-radius:50%;display:grid;place-items:center;background:#ffd500;color:#08090b;font-size:10px;font-weight:950;letter-spacing:0}
    .public-account-mobile{display:none;align-items:center;justify-content:center;margin-left:auto;margin-right:10px;flex-shrink:0}
    .public-account-mobile .public-account-link{width:42px;height:42px;min-width:42px;padding:0;border-radius:50%;gap:0;border-color:rgba(255,255,255,.16);background:rgba(255,255,255,.045)}
    .public-account-mobile .public-account-link:hover{transform:none}
    .public-account-mobile .public-account-avatar{width:34px;height:34px;font-size:10px}
    .public-account-mobile .public-account-label{display:none}
    .public-account-mobile .public-account-guest{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:rgba(255,213,0,.10);color:#ffd500}
    .public-account-mobile .public-account-guest svg{width:18px;height:18px;display:block}
    @media(max-width:1240px) and (min-width:1025px){.main-nav{gap:16px}.logo{margin-right:28px}.discord-button{padding-left:14px;padding-right:14px}.public-account-link{padding-left:10px;padding-right:10px}}
    @media(max-width:1024px){.public-account-desktop{display:none}.public-account-mobile{display:flex}}
  `;
  document.head.appendChild(style);

  function initials(value) {
    const clean = String(value || '').trim().replace(/[^\p{L}\p{N}\s_-]/gu, '');
    if (!clean) return 'HD';
    const parts = clean.split(/[\s_-]+/).filter(Boolean);
    if (parts.length > 1) return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
    const compact = parts[0].replace(/[^\p{L}\p{N}]/gu, '');
    return (compact.slice(0, 2) || 'HD').toUpperCase();
  }

  function makeLink(session, name, compact = false) {
    const link = document.createElement('a');
    link.className = 'public-account-link';
    link.href = session ? PRIVATE_URL : LOGIN_URL;
    link.setAttribute('aria-label', session ? 'Abrir Área Personal' : 'Iniciar sesión');
    link.title = session ? 'Área Personal' : 'Iniciar sesión';

    if (!session) {
      if (compact) {
        const guest = document.createElement('span');
        guest.className = 'public-account-guest';
        guest.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"/></svg>';
        link.appendChild(guest);
      } else {
        link.textContent = 'INICIAR SESIÓN';
      }
      return link;
    }

    const avatar = document.createElement('span');
    avatar.className = 'public-account-avatar';
    avatar.textContent = initials(name);
    const label = document.createElement('span');
    label.className = 'public-account-label';
    label.textContent = 'ÁREA PERSONAL';
    link.append(avatar, label);
    return link;
  }

  function mountSlots() {
    const header = document.querySelector('.main-header');
    if (!header) return null;

    let desktop = document.getElementById('publicAccountDesktop');
    if (!desktop) {
      desktop = document.createElement('div');
      desktop.id = 'publicAccountDesktop';
      desktop.className = 'public-account-desktop';
      const discord = header.querySelector('.discord-button');
      if (discord) discord.insertAdjacentElement('afterend', desktop);
      else header.appendChild(desktop);
    }

    let mobile = document.getElementById('publicAccountMobile');
    if (!mobile) {
      mobile = document.createElement('div');
      mobile.id = 'publicAccountMobile';
      mobile.className = 'public-account-mobile';
      const mobileToggle = document.getElementById('mobile-menu-toggle');
      if (mobileToggle?.parentNode) mobileToggle.parentNode.insertBefore(mobile, mobileToggle);
      else header.appendChild(mobile);
    }
    return { desktop, mobile };
  }

  function render(slots, session, name) {
    slots.desktop.textContent = '';
    slots.mobile.textContent = '';
    slots.desktop.appendChild(makeLink(session, name, false));
    slots.mobile.appendChild(makeLink(session, name, true));
  }

  function loadSupabase() {
    if (window.supabase?.createClient) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-public-supabase]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.min.js';
      script.async = true;
      script.dataset.publicSupabase = '1';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function resolveName(client, session) {
    if (!session?.user) return '';
    const fallback = session.user.user_metadata?.display_name || session.user.user_metadata?.discord_username || session.user.email?.split('@')[0] || 'HD';
    try {
      const { data } = await client
        .from('profiles')
        .select('display_name,discord_username,drivers:driver_id(nickname)')
        .eq('id', session.user.id)
        .maybeSingle();
      const nested = Array.isArray(data?.drivers) ? data.drivers[0] : data?.drivers;
      return nested?.nickname || data?.display_name || data?.discord_username || fallback;
    } catch (_) {
      return fallback;
    }
  }

  async function init() {
    const slots = mountSlots();
    if (!slots) return;
    render(slots, null, '');
    try {
      await loadSupabase();
      const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      const { data: { session } } = await client.auth.getSession();
      render(slots, session, await resolveName(client, session));
      client.auth.onAuthStateChange(async (_event, nextSession) => {
        render(slots, nextSession, await resolveName(client, nextSession));
      });
    } catch (error) {
      console.error('Public account header error:', error);
    }
  }

  loadHomepageEditorialNews();
  init();
})();