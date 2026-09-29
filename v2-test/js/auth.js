(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const params = new URLSearchParams(window.location.search);
  const requestedMode = params.get('mode') || 'register';
  const registerForm = document.getElementById('registerForm');
  const forgotForm = document.getElementById('forgotForm');
  const changeForm = document.getElementById('changeForm');
  const title = document.getElementById('accountTitle');
  const intro = document.getElementById('accountIntro');
  const message = document.getElementById('accountMessage');
  const note = document.getElementById('accountNote');

  const indexUrl = new URL('index.html', window.location.href).toString().split('#')[0].split('?')[0];
  const changePasswordUrl = new URL('auth.html?mode=change', window.location.href).toString().split('#')[0];

  function setMessage(text = '', type = '') {
    message.textContent = text;
    message.className = `account-message${type ? ` ${type}` : ''}`;
  }

  function showMode(mode) {
    registerForm.classList.toggle('is-hidden', mode !== 'register');
    forgotForm.classList.toggle('is-hidden', mode !== 'forgot');
    changeForm.classList.toggle('is-hidden', mode !== 'change');
    setMessage('');

    if (mode === 'forgot') {
      title.textContent = 'Recuperar contraseña';
      intro.textContent = 'Introduce tu correo y te enviaremos un enlace para crear una contraseña nueva.';
      note.textContent = 'Por seguridad, el mensaje mostrado será el mismo aunque el correo no esté registrado.';
    } else if (mode === 'change') {
      title.textContent = 'Nueva contraseña';
      intro.textContent = 'Elige una contraseña nueva para tu cuenta de HyperDrive League.';
      note.textContent = 'Este formulario solo funciona al abrirlo desde el enlace de recuperación enviado a tu correo.';
    } else {
      title.textContent = 'Crear cuenta';
      intro.textContent = 'Regístrate con tu correo y tu nombre de Discord. Tu cuenta quedará pendiente hasta que Administración te vincule con tu piloto.';
      note.textContent = 'El nombre de Discord es obligatorio para que Administración pueda identificarte antes de asignarte permisos.';
    }
  }

  async function setButtonBusy(form, busy, busyText, normalText) {
    const button = form.querySelector('button[type="submit"]');
    const span = button.querySelector('span');
    button.disabled = busy;
    span.textContent = busy ? busyText : normalText;
  }

  registerForm.addEventListener('submit', async event => {
    event.preventDefault();
    setMessage('');

    const discord = registerForm.discordUsername.value.trim();
    const email = registerForm.email.value.trim();
    const password = registerForm.password.value;
    const confirm = registerForm.passwordConfirm.value;

    if (discord.length < 2) return setMessage('Escribe tu nombre de Discord.', 'error');
    if (password.length < 8) return setMessage('La contraseña debe tener al menos 8 caracteres.', 'error');
    if (password !== confirm) return setMessage('Las contraseñas no coinciden.', 'error');

    await setButtonBusy(registerForm, true, 'CREANDO CUENTA…', 'CREAR CUENTA');
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: indexUrl,
        data: {
          display_name: discord,
          discord_username: discord
        }
      }
    });
    await setButtonBusy(registerForm, false, 'CREANDO CUENTA…', 'CREAR CUENTA');

    if (error) {
      console.error('Signup error:', error);
      return setMessage('No se pudo crear la cuenta. Comprueba el correo y vuelve a intentarlo.', 'error');
    }

    registerForm.reset();
    if (data.session) {
      setMessage('Cuenta creada. Ya puedes volver al acceso; tu cuenta quedará pendiente hasta que Administración te asigne un piloto y permisos.', 'success');
    } else {
      setMessage('Cuenta creada. Revisa tu correo y confirma la dirección. Después podrás iniciar sesión; Administración verá tu nombre de Discord para identificarte.', 'success');
    }
  });

  forgotForm.addEventListener('submit', async event => {
    event.preventDefault();
    setMessage('');
    const email = forgotForm.email.value.trim();
    await setButtonBusy(forgotForm, true, 'ENVIANDO…', 'ENVIAR ENLACE');
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: changePasswordUrl });
    await setButtonBusy(forgotForm, false, 'ENVIANDO…', 'ENVIAR ENLACE');
    if (error) console.error('Password recovery error:', error);
    forgotForm.reset();
    setMessage('Si ese correo pertenece a una cuenta, recibirás un enlace para cambiar la contraseña.', 'success');
  });

  changeForm.addEventListener('submit', async event => {
    event.preventDefault();
    setMessage('');
    const password = changeForm.password.value;
    const confirm = changeForm.passwordConfirm.value;
    if (password.length < 8) return setMessage('La contraseña debe tener al menos 8 caracteres.', 'error');
    if (password !== confirm) return setMessage('Las contraseñas no coinciden.', 'error');

    const { data: { session } } = await client.auth.getSession();
    if (!session) return setMessage('Abre esta página desde el enlace de recuperación que has recibido por correo.', 'error');

    await setButtonBusy(changeForm, true, 'CAMBIANDO…', 'CAMBIAR CONTRASEÑA');
    const { error } = await client.auth.updateUser({ password });
    await setButtonBusy(changeForm, false, 'CAMBIANDO…', 'CAMBIAR CONTRASEÑA');
    if (error) {
      console.error('Password update error:', error);
      return setMessage('No se pudo cambiar la contraseña. Solicita un enlace nuevo e inténtalo otra vez.', 'error');
    }
    changeForm.reset();
    setMessage('Contraseña actualizada correctamente. Ya puedes volver e iniciar sesión.', 'success');
  });

  client.auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') showMode('change');
  });

  showMode(['register','forgot','change'].includes(requestedMode) ? requestedMode : 'register');
})();