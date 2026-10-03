(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  const adminContent=document.getElementById('adminContent');
  if(!adminContent) return;

  const esc=v=>String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  let teams=[],drivers=[],roster=[];

  async function fetchData(){
    const [teamsRes,driversRes,rosterRes]=await Promise.all([
      client.from('teams').select('id,name').eq('is_active',true).order('name'),
      client.from('drivers').select('id,nickname,race_number,is_active').eq('is_active',true).order('nickname'),
      client.rpc('admin_roster_overview',{p_season_number:config.currentSeason})
    ]);
    const bad=[teamsRes,driversRes,rosterRes].find(r=>r.error); if(bad) throw bad.error;
    teams=teamsRes.data||[]; drivers=driversRes.data||[]; roster=rosterRes.data||[];
  }

  function teamOptions(selected){
    return teams.map(t=>'<option value="'+esc(t.id)+'" '+(t.id===selected?'selected':'')+'>'+esc(t.name)+'</option>').join('');
  }
  function driverOptions(selected){
    return drivers.map(d=>'<option value="'+esc(d.id)+'" '+(d.id===selected?'selected':'')+'>#'+esc(d.race_number??'--')+' · '+esc(d.nickname)+'</option>').join('');
  }
  function divOptions(selected){
    return ['academy','hyperdrive'].map(v=>'<option value="'+v+'" '+(v===selected?'selected':'')+'>'+(v==='academy'?'Academy':'HyperDrive')+'</option>').join('');
  }
  function statusOptions(selected){
    return ['official','reserve'].map(v=>'<option value="'+v+'" '+(v===selected?'selected':'')+'>'+(v==='official'?'Oficial':'Reserva')+'</option>').join('');
  }

  function render(){
    let heading=document.getElementById('rosterAdminHeading');
    let panel=document.getElementById('rosterAdminPanel');
    if(!heading){
      heading=document.createElement('section');
      heading.id='rosterAdminHeading';
      heading.className='module-section-heading';
      heading.innerHTML='<div><span class="eyebrow">PILOTOS</span><h2>Gestión de pilotos y alineaciones</h2></div><span class="season-badge">T'+config.currentSeason+'</span>';
      panel=document.createElement('section');
      panel.id='rosterAdminPanel';
      panel.className='admin-panel roster-admin-panel';
      const permissionsHeading=document.querySelector('#roleDistribution')?.previousElementSibling;
      (permissionsHeading?.parentNode||adminContent).insertBefore(heading,permissionsHeading||null);
      (permissionsHeading?.parentNode||adminContent).insertBefore(panel,permissionsHeading||null);
    }

    panel.innerHTML=`
      <div class="roster-admin-grid">
        <div class="roster-box">
          <h3>Crear piloto nuevo</h3>
          <form id="standalonePilotForm" class="roster-form">
            <label class="roster-field"><span>NOMBRE / GAMERTAG</span><input name="nickname" required></label>
            <label class="roster-field"><span>DORSAL</span><input name="race_number" type="number" min="0" step="1"></label>
            <label class="roster-field"><span>PAÍS</span><input name="country_code" maxlength="2" value="ES"></label>
            <label class="roster-field"><span>REGIÓN</span><input name="region" placeholder="Murcia, Almería…"></label>
            <label class="roster-field full"><span>NOMBRE EN RESULTADOS SI ES DISTINTO</span><input name="result_alias" placeholder="Déjalo vacío si coincide con el gamertag"></label>
            <label class="roster-field"><span>ESCUDERÍA</span><select name="team_id" required><option value="">Selecciona</option>${teamOptions('')}</select></label>
            <label class="roster-field"><span>DIVISIÓN</span><select name="division">${divOptions('academy')}</select></label>
            <label class="roster-field"><span>TIPO</span><select name="roster_status">${statusOptions('official')}</select></label>
            <label class="roster-field"><span>DESDE RONDA</span><input name="start_round" type="number" min="1" value="5" required></label>
            <div class="roster-actions"><button class="primary-button" type="submit"><span>CREAR PILOTO</span></button><p class="roster-status"></p></div>
          </form>
        </div>
        <div class="roster-box">
          <h3>Nueva asignación / fichaje</h3>
          <form id="assignRosterForm" class="roster-form">
            <label class="roster-field full"><span>PILOTO EXISTENTE</span><select name="driver_id" required><option value="">Selecciona</option>${driverOptions('')}</select></label>
            <label class="roster-field"><span>ESCUDERÍA</span><select name="team_id" required><option value="">Selecciona</option>${teamOptions('')}</select></label>
            <label class="roster-field"><span>DIVISIÓN</span><select name="division">${divOptions('academy')}</select></label>
            <label class="roster-field"><span>TIPO</span><select name="roster_status">${statusOptions('official')}</select></label>
            <label class="roster-field"><span>DESDE RONDA</span><input name="start_round" type="number" min="1" value="5" required></label>
            <div class="roster-actions"><button class="primary-button" type="submit"><span>GUARDAR FICHAJE</span></button><p class="roster-status"></p></div>
          </form>
        </div>
      </div>
      <div class="module-section-heading" style="margin-top:26px"><div><span class="eyebrow">ALINEACIONES T${config.currentSeason}</span><h2>Historial y estado actual</h2></div></div>
      <div class="roster-table-wrap"><table class="roster-table"><thead><tr><th>Piloto</th><th>Equipo</th><th>División</th><th>Tipo</th><th>Inicio</th><th>Fin</th><th>Estado</th><th>Acciones</th></tr></thead><tbody id="rosterRows"></tbody></table></div>
    `;

    const body=panel.querySelector('#rosterRows');
    roster.forEach(item=>{
      const tr=document.createElement('tr');
      tr.dataset.id=item.roster_id;
      tr.innerHTML=`
        <td class="roster-driver"><strong>#${esc(item.race_number??'--')} ${esc(item.nickname)}</strong><small>${esc((item.result_aliases||[]).join(' · '))} · Banco ${Number(item.bank_balance_m||0).toFixed(2)} M${item.has_user_account?' · Cuenta vinculada':' · Sin cuenta'}</small></td>
        <td><select name="team_id">${teamOptions(item.team_id)}</select></td>
        <td><select name="division">${divOptions(item.division)}</select></td>
        <td><select name="roster_status">${statusOptions(item.roster_status)}</select></td>
        <td><input name="start_round" type="number" min="1" value="${esc(item.start_round)}"></td>
        <td><input name="end_round" type="number" min="1" value="${esc(item.end_round??'')}" placeholder="—"></td>
        <td><span class="${item.is_active?'roster-active':'roster-ended'}">${item.is_active?'ACTIVA':'FINALIZADA'}</span></td>
        <td><div class="roster-row-actions"><button class="roster-save" type="button">GUARDAR</button>${item.is_active?'<button class="roster-end" type="button">FINALIZAR</button>':''}</div></td>
      `;
      body.appendChild(tr);

      tr.querySelector('.roster-save').addEventListener('click',()=>saveRow(tr,item));
      const endBtn=tr.querySelector('.roster-end');
      if(endBtn) endBtn.addEventListener('click',()=>endRow(tr,item));
    });

    wireForms(panel);
  }

  function setFormStatus(form,msg,type=''){
    const p=form.querySelector('.roster-status'); p.textContent=msg; p.className='roster-status'+(type?' '+type:'');
  }

  function wireForms(panel){
    const create=panel.querySelector('#standalonePilotForm');
    create.addEventListener('submit',async e=>{
      e.preventDefault(); setFormStatus(create,'');
      const fd=new FormData(create); const btn=create.querySelector('button'); btn.disabled=true; btn.querySelector('span').textContent='CREANDO…';
      const {error}=await client.rpc('admin_create_driver',{
        p_nickname:String(fd.get('nickname')||'').trim(),
        p_race_number:fd.get('race_number')?Number(fd.get('race_number')):null,
        p_country_code:String(fd.get('country_code')||'').trim()||null,
        p_region:String(fd.get('region')||'').trim()||null,
        p_result_alias:String(fd.get('result_alias')||'').trim()||null,
        p_season_number:config.currentSeason,
        p_team_id:fd.get('team_id')||null,
        p_division:fd.get('division'),
        p_roster_status:fd.get('roster_status'),
        p_start_round:Number(fd.get('start_round')),
        p_user_id:null,p_roles:null,p_principal_team_id:null
      });
      if(error){setFormStatus(create,error.message||'No se pudo crear el piloto.','error');btn.disabled=false;btn.querySelector('span').textContent='CREAR PILOTO';return;}
      setFormStatus(create,'Piloto creado con Banco del Piloto, 5 M, Superlicencia y alineación.','success');
      setTimeout(()=>window.location.reload(),700);
    });

    const assign=panel.querySelector('#assignRosterForm');
    assign.addEventListener('submit',async e=>{
      e.preventDefault(); setFormStatus(assign,'');
      const fd=new FormData(assign); const btn=assign.querySelector('button'); btn.disabled=true; btn.querySelector('span').textContent='GUARDANDO…';
      const {error}=await client.rpc('admin_assign_driver_roster',{
        p_driver_id:fd.get('driver_id'),p_season_number:config.currentSeason,p_team_id:fd.get('team_id'),
        p_division:fd.get('division'),p_roster_status:fd.get('roster_status'),p_start_round:Number(fd.get('start_round'))
      });
      if(error){setFormStatus(assign,error.message||'No se pudo guardar el fichaje.','error');btn.disabled=false;btn.querySelector('span').textContent='GUARDAR FICHAJE';return;}
      setFormStatus(assign,'Asignación actualizada correctamente.','success'); setTimeout(()=>window.location.reload(),650);
    });
  }

  async function saveRow(tr,item){
    const btn=tr.querySelector('.roster-save'); btn.disabled=true;
    const end=tr.querySelector('[name="end_round"]').value;
    const {error}=await client.rpc('admin_update_roster_assignment',{
      p_roster_id:item.roster_id,
      p_team_id:tr.querySelector('[name="team_id"]').value,
      p_division:tr.querySelector('[name="division"]').value,
      p_roster_status:tr.querySelector('[name="roster_status"]').value,
      p_start_round:Number(tr.querySelector('[name="start_round"]').value),
      p_end_round:end?Number(end):null,
      p_is_active:item.is_active
    });
    if(error){window.alert(error.message||'No se pudo guardar.');btn.disabled=false;return;}
    window.location.reload();
  }

  async function endRow(tr,item){
    const proposed=tr.querySelector('[name="end_round"]').value || window.prompt('¿En qué ronda termina esta asignación?',String(Math.max(item.start_round,4)));
    if(!proposed) return;
    const {error}=await client.rpc('admin_end_roster_assignment',{p_roster_id:item.roster_id,p_end_round:Number(proposed)});
    if(error){window.alert(error.message||'No se pudo finalizar la asignación.');return;}
    window.location.reload();
  }

  async function init(){
    const {data:{session}}=await client.auth.getSession(); if(!session) return;
    const check=await client.from('user_roles').select('role').eq('user_id',session.user.id).eq('role','admin').maybeSingle();
    if(!check.data) return;
    try{await fetchData();render();}catch(err){console.error('Roster admin error',err);}
  }

  if(!adminContent.classList.contains('is-hidden')) init();
  else{
    const obs=new MutationObserver(()=>{if(!adminContent.classList.contains('is-hidden')){obs.disconnect();init();}});
    obs.observe(adminContent,{attributes:true,attributeFilter:['class']});
  }
})();