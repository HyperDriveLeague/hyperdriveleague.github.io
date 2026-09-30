(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, { auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true} });
  const adminContent = document.getElementById('adminContent');
  const roleDistribution = document.getElementById('roleDistribution');
  if (!adminContent || !roleDistribution) return;

  const esc = value => String(value ?? '').replace(/[&<>'\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[ch]));
  const roleNames = {pilot:'Piloto',team_principal:'Team Principal',staff:'Staff',admin:'Admin'};

  async function init() {
    const { data:{session} } = await client.auth.getSession();
    if (!session) return;

    const [adminCheck, profilesRes, rolesRes, principalsRes, driversRes, teamsRes] = await Promise.all([
      client.from('user_roles').select('role').eq('user_id',session.user.id).eq('role','admin').maybeSingle(),
      client.from('profiles').select('id,driver_id,display_name,discord_username,is_active,application_status,drivers:driver_id(id,nickname,race_number)').neq('application_status','discarded').order('display_name'),
      client.from('user_roles').select('user_id,role'),
      client.from('team_principals').select('user_id,team_id,season_number,is_active').eq('season_number',config.currentSeason).eq('is_active',true),
      client.from('drivers').select('id,nickname,race_number,is_active').eq('is_active',true).order('nickname'),
      client.from('teams').select('id,name').order('name')
    ]);
    if (!adminCheck.data || [profilesRes,rolesRes,principalsRes,driversRes,teamsRes].some(r=>r.error)) return;

    const profiles = profilesRes.data || [];
    const roles = rolesRes.data || [];
    const principals = principalsRes.data || [];
    const drivers = driversRes.data || [];
    const teams = teamsRes.data || [];
    const configured = profiles.filter(p => roles.some(r => r.user_id === p.id));

    const heading = document.createElement('section');
    heading.className = 'module-section-heading';
    heading.innerHTML = '<div><span class="eyebrow">GESTIÓN</span><h2>Editar usuarios y permisos</h2></div><span class="season-badge">SOLO ADMIN</span>';

    const panel = document.createElement('section');
    panel.className = 'admin-panel role-editor-panel';
    panel.innerHTML = `<div class="role-editor-grid"><div class="role-editor-box"><h3>Selecciona una cuenta</h3><label class="role-editor-field"><span>Usuario</span><select id="roleEditorUser"><option value="">Selecciona usuario</option>${configured.map(p=>{const d=p.drivers;const name=p.discord_username||p.display_name||d?.nickname||p.id.slice(0,8);const suffix=d?` · #${esc(d.race_number??'--')} ${esc(d.nickname)}`:'';return `<option value="${esc(p.id)}">${esc(name)}${suffix}</option>`}).join('')}</select></label><p id="roleEditorUserInfo" class="role-editor-user">Selecciona una cuenta para editar sus permisos.</p><form id="roleEditorForm"><fieldset class="role-editor-roles"><legend>Roles</legend>${Object.entries(roleNames).map(([value,label])=>`<label><input type="checkbox" name="roles" value="${value}"><span>${label}</span></label>`).join('')}</fieldset><label class="role-editor-field"><span>Piloto vinculado</span><select id="roleEditorDriver"><option value="">Sin piloto</option></select></label><label class="role-editor-field"><span>Escudería Team Principal</span><select id="roleEditorTeam"><option value="">Sin escudería</option></select></label><button id="roleEditorSave" class="primary-button role-editor-save" type="submit" disabled><span>GUARDAR CAMBIOS</span></button><p id="roleEditorStatus" class="role-editor-status" aria-live="polite"></p></form></div><div class="role-editor-box"><h3>Cómo funciona</h3><p class="role-editor-note">Desmarca un rol y pulsa <strong>Guardar cambios</strong> para retirarlo. Si quitas <strong>Piloto</strong>, la cuenta queda desvinculada del piloto. Si quitas <strong>Team Principal</strong>, se cierra su asignación activa de escudería. Puedes dejar una cuenta sin ningún rol; volverá a aparecer como pendiente. El sistema impide quitar el último rol <strong>Admin</strong> existente.</p></div></div>`;

    const permissionsHeading = roleDistribution.previousElementSibling;
    permissionsHeading.parentNode.insertBefore(heading, permissionsHeading);
    permissionsHeading.parentNode.insertBefore(panel, permissionsHeading);

    const userSelect = panel.querySelector('#roleEditorUser');
    const form = panel.querySelector('#roleEditorForm');
    const driverSelect = panel.querySelector('#roleEditorDriver');
    const teamSelect = panel.querySelector('#roleEditorTeam');
    const info = panel.querySelector('#roleEditorUserInfo');
    const save = panel.querySelector('#roleEditorSave');
    const status = panel.querySelector('#roleEditorStatus');

    const selectedRoles = () => [...form.querySelectorAll('input[name="roles"]:checked')].map(i=>i.value);

    function syncFields() {
      const chosen = selectedRoles();
      driverSelect.disabled = !chosen.includes('pilot');
      teamSelect.disabled = !chosen.includes('team_principal');
      if (!chosen.includes('pilot')) driverSelect.value = '';
      if (!chosen.includes('team_principal')) teamSelect.value = '';
    }

    function populate(userId) {
      status.textContent=''; status.className='role-editor-status';
      const profile = profiles.find(p=>p.id===userId);
      if (!profile) { save.disabled=true; return; }
      const currentRoles = roles.filter(r=>r.user_id===userId).map(r=>r.role);
      const currentPrincipal = principals.find(p=>p.user_id===userId) || null;
      const usedDriverIds = new Set(profiles.filter(p=>p.id!==userId && p.driver_id).map(p=>p.driver_id));
      const occupiedTeamIds = new Set(principals.filter(p=>p.user_id!==userId).map(p=>p.team_id));

      form.querySelectorAll('input[name="roles"]').forEach(input=>{ input.checked=currentRoles.includes(input.value); });
      driverSelect.innerHTML = '<option value="">Sin piloto</option>' + drivers.filter(d=>!usedDriverIds.has(d.id)||d.id===profile.driver_id).map(d=>`<option value="${esc(d.id)}">#${esc(d.race_number??'--')} · ${esc(d.nickname)}</option>`).join('');
      teamSelect.innerHTML = '<option value="">Sin escudería</option>' + teams.filter(t=>!occupiedTeamIds.has(t.id)||t.id===currentPrincipal?.team_id).map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
      driverSelect.value = profile.driver_id || '';
      teamSelect.value = currentPrincipal?.team_id || '';
      const shownName = profile.discord_username || profile.display_name || profile.drivers?.nickname || 'Usuario';
      info.textContent = `${shownName} · ${currentRoles.length ? currentRoles.map(r=>roleNames[r]||r).join(', ') : 'Sin roles'}`;
      save.disabled=false;
      syncFields();
    }

    userSelect.addEventListener('change',()=>populate(userSelect.value));
    form.querySelectorAll('input[name="roles"]').forEach(input=>input.addEventListener('change',syncFields));

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const userId = userSelect.value;
      if (!userId) return;
      const chosen = selectedRoles();
      const adminCount = new Set(roles.filter(r=>r.role==='admin').map(r=>r.user_id)).size;
      const targetWasAdmin = roles.some(r=>r.user_id===userId && r.role==='admin');
      if (targetWasAdmin && !chosen.includes('admin') && adminCount<=1) {
        status.className='role-editor-status error';
        status.textContent='No puedes quitar el último rol Admin del sistema.';
        return;
      }
      const driverId = chosen.includes('pilot') ? (driverSelect.value || null) : null;
      const teamId = chosen.includes('team_principal') ? (teamSelect.value || null) : null;
      if (chosen.includes('pilot') && !driverId) { status.className='role-editor-status error'; status.textContent='Selecciona un piloto o quita el rol Piloto.'; return; }
      if (chosen.includes('team_principal') && !teamId) { status.className='role-editor-status error'; status.textContent='Selecciona una escudería o quita Team Principal.'; return; }
      save.disabled=true; save.querySelector('span').textContent='GUARDANDO…';
      const { error } = await client.rpc('staff_link_user',{p_user_id:userId,p_driver_id:driverId,p_roles:chosen,p_team_id:teamId,p_season_number:config.currentSeason});
      if (error) {
        status.className='role-editor-status error';
        status.textContent=error.message || 'No se pudieron guardar los cambios.';
        save.disabled=false; save.querySelector('span').textContent='GUARDAR CAMBIOS';
        return;
      }
      status.className='role-editor-status success';
      status.textContent='Permisos actualizados correctamente.';
      setTimeout(()=>window.location.reload(),700);
    });
  }

  if (!adminContent.classList.contains('is-hidden')) init();
  else {
    const observer = new MutationObserver(()=>{if(!adminContent.classList.contains('is-hidden')){observer.disconnect();init();}});
    observer.observe(adminContent,{attributes:true,attributeFilter:['class']});
  }
})();