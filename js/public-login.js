(() => {
  const SUPABASE_URL = 'https://knyxattsjimsjefydcad.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_hLAzZZF6kki1xZ0Kyx6lfA_97kzSAmf';
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const form = document.getElementById('publicLoginForm');
  const email = document.getElementById('publicLoginEmail');
  const password = document.getElementById('publicLoginPassword');
  const button = document.getElementById('publicLoginButton');
  const message = document.getElementById('publicLoginMessage');

  function returnUrl() {
    const raw = new URLSearchParams(window.location.search).get('return');
    if (!raw) return 'index.html';
    try {
      const target = new URL(raw, window.location.href);
      if (target.origin !== window.location.origin) return 'index.html';
      return `${target.pathname}${target.search}${target.hash}`;
    } catch (_) {
      return 'index.html';
    }
  }

  function setMessage(text = '', type = '') {
    message.textContent = text;
    message.className = `public-login-message${type ? ` ${type}` : ''}`;
  }

  async function init() {
    const { data: { session } } = await client.auth.getSession();
    if (session) window.location.replace(returnUrl());
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const mail = email.value.trim();
    if (!mail || !password.value) return setMessage('Introduce tu correo y contraseña.', 'error');

    button.disabled = true;
    button.textContent = 'INICIANDO SESIÓN…';
    setMessage('Comprobando tus datos…');

    const { error } = await client.auth.signInWithPassword({ email: mail, password: password.value });
    if (error) {
      button.disabled = false;
      button.textContent = 'INICIAR SESIÓN';
      setMessage('Correo o contraseña incorrectos.', 'error');
      return;
    }

    setMessage('Sesión iniciada. Volviendo a HyperDrive…', 'success');
    window.location.replace(returnUrl());
  });

  init();
})();