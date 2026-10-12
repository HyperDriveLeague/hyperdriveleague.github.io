(() => {
  const cfg=window.HYPERDRIVE_CONFIG;
  if(!cfg||!window.supabase||!document.getElementById('cmForm'))return;
  const db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const $=id=>document.getElementById(id);
  const escape=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money=v=>Number(v||0).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' M';
  const labelHalf=h=>'T'+Math.floor(h/2)+' · '+(h%2?'2.ª':'1.ª')+' mitad';
  let contracts=[],terms=[],drivers=[],teams=[],accounts=[],actions=[],rosters=[],principals=[],profiles=[],editing=null;
  let contractMap=new Map(),termMap=new Map(),driverMap=new Map(),teamMap=new Map(),accountMap=new Map();
  let initialized=false,loading=false;
  const season=()=>Number($('cmSeason').value||cfg.currentSeason);
  const market=()=>Number($('cmMoment').value||0);
  const currentHalf=()=>season()*2+market();
  const notice=(text,type='')=>{ $('cmMessage').textContent=text;$('cmMessage').className='contracts-notice'+(type?' '+type:''); };
  const periodsSum=(arr,a,b)=>((arr||[]).reduce((sum,x)=>{const half=Number(x.half);return sum+(half>=a&&half<=b?Number(x.amount||0):0)},0));
  const currentValue=c=>{
    const t=termMap.get(c.id);
    return t?periodsSum(t.periods,season()*2,1000):Number(c.driver_value_m||0);
  };
  const currentClause=c=>{
    const t=termMap.get(c.id);
    return t?Math.round(currentValue(c)*150)/100:Number(c.buyout_clause_m||0);
  };
  const seasonCap=c=>{
    const t=termMap.get(c.id),base=2*season();
    if(!t)return accountMap.get(c.team_account_id)?.season_number===season()?Number(c.driver_value_m||0):0;
    const spread=periodsSum(t.periods,base,base+1);
    return t.imported_legacy&&Number(t.import_season)===season()?
      Number(t.legacy_cap_m||0)+spread-periodsSum(t.legacy_periods,base,base+1):spread;
  };
  const accountFor=c=>accountMap.get(c.team_account_id);
  const teamFor=c=>teamMap.get(accountFor(c)?.team_id);
  const driverFor=c=>driverMap.get(c.driver_id);
  const ownerDriverIds=()=>{
    const byUser=new Map(profiles.map(p=>[p.id,p.driver_id]));
    const own=new Set();
    principals.filter(p=>p.is_active&&p.season_number===season()).forEach(p=>{
      const driverId=byUser.get(p.user_id);
      if(driverId&&rosters.some(r=>r.driver_id===driverId&&r.team_id===p.team_id&&r.season_number===season()&&r.is_active))own.add(driverId);
    });
    return own;
  };
  const activeNow=c=>!c.is_team_principal_contract&&c.status==='active'&&(!termMap.has(c.id)||Number(termMap.get(c.id).end_half)>=currentHalf());
  const nameFor=c=>(driverFor(c)?.nickname||'Piloto')+' · '+(teamFor(c)?.name||'Sin escudería');
  const sortedActive=()=>contracts.filter(activeNow).sort((a,b)=>nameFor(a).localeCompare(nameFor(b),'es'));
  const expiry=t=>t?labelHalf(t.end_half):(t=>t||'Sin especificar')(null);

  function syncForm(){
    const kind=$('cmKind').value;
    const hasContract=kind!=='new';
    $('cmContractWrap').hidden=!hasContract;
    $('cmDriverWrap').hidden=hasContract;
    $('cmTeamWrap').hidden=!['new','buyout'].includes(kind);
    $('cmDivisionWrap').hidden=!['new','buyout'].includes(kind);
    $('cmHalvesWrap').hidden=(kind==='raise');
    $('cmAmountWrap').hidden=(kind==='import');
    $('cmAllocationWrap').hidden=(kind!=='raise');
    $('cmRoundWrap').hidden=!['new','buyout'].includes(kind);
    const prev=$('cmContract').value;
    const edited=actions.find(a=>a.id===editing);
    const pool=contracts.filter(c=>(activeNow(c)||edited?.payload?.contract_id===c.id)&&
      (edited?.payload?.contract_id===c.id|| (kind==='import'?!termMap.has(c.id):kind==='new'?false:!!termMap.has(c.id))));
    $('cmContract').innerHTML=pool.map(c=>'<option value="'+escape(c.id)+'">'+escape(nameFor(c))+'</option>').join('')||'<option value="">Sin contratos disponibles</option>';
    if(pool.some(c=>c.id===prev))$('cmContract').value=prev;
    $('cmFormTitle').textContent=editing?'Editar operación':'Registrar operación';
    updatePreview();
  }

  function updatePreview(){
    const kind=$('cmKind').value;
    const contract=contractMap.get($('cmContract').value);
    const count=Number($('cmHalves').value);
    const amount=Number($('cmAmount').value||0);
    const initial=season()*2+market();
    const term=termMap.get(contract?.id);
    let summary='';
    if(kind==='import'){
      summary='No se crea ningún gasto ni se añade ningún coste al salary cap. Solo se establece el calendario del contrato heredado.';
      if(contract)summary+=' Importe heredado: '+money(contract.driver_value_m)+'.';
    }else if(kind==='new'||kind==='buyout'){
      const chunks=Array.from({length:count},(_,i)=>({h:initial+i,v:amount/count}));
      const bySeason={};chunks.forEach(x=>bySeason[Math.floor(x.h/2)]=(bySeason[Math.floor(x.h/2)]||0)+x.v);
      summary='Contrato: '+money(amount)+' pagados ahora. Salary cap: '+Object.entries(bySeason).map(([s,v])=>'T'+s+' '+money(v)).join(' · ')+'.';
      if(kind==='buyout'&&contract)summary+=' Cláusula al equipo anterior: '+money(currentClause(contract))+' (importe adicional al contrato).';
    }else if(kind==='extend'){
      summary='Se pagan '+money(amount)+' ahora. Se añaden '+count+' medias temporadas al final del contrato.';
      if(term)summary+=' Nuevo vencimiento: '+labelHalf(Number(term.end_half)+count)+'.';
    }else{
      summary='Se pagan '+money(amount)+' ahora. El aumento '+($('cmAllocation').value==='last'?'se asigna a la última mitad del contrato.':'se reparte entre las medias temporadas restantes.');
      if(term)summary+=' Vencimiento sin cambios: '+labelHalf(term.end_half)+'.';
    }
    $('cmPreview').textContent=summary;
  }

  function renderStats(){
    const active=sortedActive(),owned=ownerDriverIds(),free=drivers.filter(d=>!owned.has(d.id)&&!active.some(c=>c.driver_id===d.id)),unmapped=active.filter(c=>!termMap.has(c.id));
    $('cmStats').innerHTML=[
      ['Contratos vigentes',active.length],['Pilotos sin contrato',free.length],['Team Principals',new Set(principals.filter(p=>p.is_active&&p.season_number===season()).map(p=>p.team_id)).size],['Por periodizar',unmapped.length]
    ].map(([title,value])=>'<div class="contracts-stat"><strong>'+value+'</strong><span>'+escape(title)+'</span></div>').join('');
  }

  function renderActive(){
    const q=$('cmSearch').value.trim().toLocaleLowerCase();
    const list=sortedActive().filter(c=>nameFor(c).toLocaleLowerCase().includes(q));
    $('cmActiveBody').innerHTML=list.length?list.map(c=>{
      const t=termMap.get(c.id);
      return '<tr><td><strong>'+escape(driverFor(c)?.nickname||'Piloto')+'</strong><small>'+escape(teamFor(c)?.name||'—')+(t&&t.imported_legacy?' · heredado':'')+'</small></td>'+
       '<td>'+(t?((Number(t.end_half)-Number(t.start_half)+1)/2).toLocaleString('es-ES')+' temp.':(c.half_seasons_remaining ? (Number(c.half_seasons_remaining)/2).toLocaleString('es-ES')+' temp.':'Por definir'))+'</td>'+
       '<td>'+money(t?.paid_total_m??c.driver_value_m)+'</td>'+
       '<td>'+money(currentClause(c))+'</td>'+
       '<td>'+money(seasonCap(c))+'</td>'+
       '<td>'+escape(t?expiry(t):(c.contract_end_label||'Por definir'))+'</td>'+
       '<td><button type="button" class="contracts-mini" data-pick="'+escape(c.id)+'">'+(t?'Gestionar':'Integrar')+'</button></td></tr>';
    }).join(''):'<tr><td colspan="7">No se han encontrado contratos.</td></tr>';
  }

  function renderFree(){
    const activeIds=new Set(sortedActive().map(c=>c.driver_id));
    const owned=ownerDriverIds();
    const free=drivers.filter(d=>!owned.has(d.id)&&!activeIds.has(d.id)).sort((a,b)=>a.nickname.localeCompare(b.nickname,'es'));
    $('cmFreeList').innerHTML=free.length?free.map(d=>{
      const expired=contracts.some(c=>c.driver_id===d.id&&termMap.get(c.id)?.end_half<currentHalf());
      return '<div class="contracts-free-entry"><strong>'+escape(d.nickname)+'</strong><span>'+(expired?'Vencido':'Sin contrato')+'</span><button type="button" class="contracts-mini" data-free="'+escape(d.id)+'">Contratar</button></div>';
    }).join(''):'<div class="empty-line">Todos los pilotos tienen contrato registrado.</div>';
  }

  function renderOwners(){
    const byUser=new Map(profiles.map(p=>[p.id,p.driver_id]));
    const all=principals.filter(p=>p.is_active&&p.season_number===season());
    const unique=new Map(all.map(p=>[p.team_id,p]));
    const entries=[...unique.values()].sort((a,b)=>(teamMap.get(a.team_id)?.name||'').localeCompare(teamMap.get(b.team_id)?.name||'','es'));
    const owned=ownerDriverIds();
    const mismatches=entries.filter(p=>!owned.has(byUser.get(p.user_id)));
    $('cmOwnerList').innerHTML=entries.length?entries.map(p=>{
      const driverId=byUser.get(p.user_id);
      const driver=driverMap.get(driverId);
      const team=teamMap.get(p.team_id);
      const roster=rosters.find(r=>r.driver_id===driverId&&r.season_number===season()&&r.is_active);
      const matches=owned.has(driverId);
      const teamName=team?.name||'Escudería';
      const label=matches?'PROPIETARIO · SIN CLÁUSULA':(roster?'REVISAR: ficha en '+(teamMap.get(roster.team_id)?.name||'otro equipo'):'REVISAR: sin piloto vinculado a plantilla');
      return '<div class="contracts-free-entry'+(matches?'':' contracts-owner-warning')+'"><strong>'+
       escape(teamName)+' · '+escape(driver?.nickname||'Piloto sin vincular')+
       '</strong><span>'+escape(label)+'</span></div>';
    }).join(''):'<div class="empty-line">No hay Team Principals para esta temporada.</div>';
    if(mismatches.length) {
      $('cmOwnerList').insertAdjacentHTML('afterbegin','<p class="contracts-owner-notice">Hay '+mismatches.length+' Team Principal(s) cuya escudería no coincide con la plantilla. Debes corregir la asignación antes de excluir su contrato y salary cap.</p>');
    }
  }
  const kindNames={import:'Integración sin cargo',new:'Nuevo contrato',extend:'Ampliación',raise:'Subida de cláusula',buyout:'Fichaje por cláusula'};
  function renderHistory(){
    const ordered=[...actions].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    const latest=new Map();
    ordered.forEach(a=>{if(a.status==='active'&&!latest.has(a.driver_id))latest.set(a.driver_id,a.id)});
    $('cmHistory').innerHTML=ordered.length?ordered.slice(0,150).map(a=>{
      const can=a.status==='active'&&latest.get(a.driver_id)===a.id;
      const team=teamMap.get(a.payload?.team_id)?.name||'';
      return '<div class="contracts-history-entry '+(a.status==='voided'?'voided':'')+'"><div><strong>'+
       escape(driverMap.get(a.driver_id)?.nickname||'Piloto')+' · '+escape(kindNames[a.kind]||a.kind)+
       '</strong><small>'+new Date(a.created_at).toLocaleString('es-ES')+' · '+
       (a.kind==='import'?'Sin movimiento bancario':money(a.payload?.amount||0))+
       (team?' · '+escape(team):'')+' · '+(a.status==='voided'?'Revertida':'Registrada')+
       '</small></div><div class="contracts-history-actions">'+
       (a.status==='active'?'<button type="button" data-edit="'+a.id+'" '+(!can?'disabled title="Primero rectifica la acción posterior"':'')+'>Editar</button><button type="button" class="danger" data-undo="'+a.id+'" '+(!can?'disabled title="Primero rectifica la acción posterior"':'')+'>Eliminar / Revertir</button>':'<span>Registro conservado</span>')+
       '</div></div>';
    }).join(''):'<div class="empty-line">Todavía no hay operaciones registradas en este módulo.</div>';
  }

  function renderOptions(){
    const previousDriver=$('cmDriver').value,previousTeam=$('cmTeam').value;
    $('cmDriver').innerHTML=drivers.map(d=>'<option value="'+escape(d.id)+'">'+escape(d.nickname)+'</option>').join('');
    if(drivers.some(d=>d.id===previousDriver))$('cmDriver').value=previousDriver;
    $('cmTeam').innerHTML=teams.map(t=>'<option value="'+escape(t.id)+'">'+escape(t.name)+'</option>').join('');
    if(teams.some(t=>t.id===previousTeam))$('cmTeam').value=previousTeam;
    syncForm();
  }
  function render(){renderStats();renderOptions();renderActive();renderFree();renderOwners();renderHistory();}

  async function reload(){
    if(loading)return;
    loading=true;$('cmReload').disabled=true;notice('Actualizando datos…');
    try{
      const session=await db.auth.getSession();
      if(!session.data.session)throw new Error('Inicia sesión para acceder al módulo.');
      const role=await db.from('user_roles').select('role').eq('user_id',session.data.session.user.id).eq('role','admin').maybeSingle();
      if(role.error||!role.data)throw new Error('Tu cuenta no tiene permisos de administración.');
      const req=await Promise.all([
        db.from('driver_contracts').select('*'),
        db.from('contract_terms').select('*'),
        db.from('drivers').select('id,nickname,race_number,is_active').eq('is_active',true).order('nickname'),
        db.from('teams').select('id,name,slug').order('name'),
        db.from('team_accounts').select('id,team_id,season_number,is_active'),
        db.from('contract_admin_actions').select('*').order('created_at',{ascending:false}).limit(300),
        db.from('season_roster').select('id,driver_id,team_id,season_number,start_round,end_round,division,is_active'),
        db.from('team_principals').select('user_id,team_id,season_number,is_active').eq('is_active',true),
        db.from('profiles').select('id,driver_id').not('driver_id','is',null)
      ]);
      const fail=req.find(r=>r.error);if(fail)throw fail.error;
      [contracts,terms,drivers,teams,accounts,actions,rosters,principals,profiles]=req.map(r=>r.data||[]);
      contractMap=new Map(contracts.map(c=>[c.id,c]));
      termMap=new Map(terms.map(t=>[t.contract_id,t]));
      driverMap=new Map(drivers.map(d=>[d.id,d]));
      teamMap=new Map(teams.map(t=>[t.id,t]));
      accountMap=new Map(accounts.map(a=>[a.id,a]));
      render();initialized=true;notice('Datos actualizados. Los contratos existentes no generan cargos al consultarlos.','ok');
    }catch(e){console.error('Contract admin:',e);notice('Error al cargar: '+(e.message||'Desconocido'),'error')}
    finally{loading=false;$('cmReload').disabled=false;}
  }

  function payload(){
    const kind=$('cmKind').value, c=contractMap.get($('cmContract').value);
    return {
      kind,driver_id:kind==='new'?$('cmDriver').value:c?.driver_id,
      contract_id:kind==='new'?null:c?.id,
      team_id:['new','buyout'].includes(kind)?$('cmTeam').value:null,
      season:season(),market_half:market(),halves:Number($('cmHalves').value),
      amount:Number($('cmAmount').value||0),
      allocation:$('cmAllocation').value,
      division:$('cmDivision').value,start_round:Number($('cmRound').value)
    };
  }
  function cancelEdit(){
    editing=null;$('cmKind').disabled=false;$('cmCancel').classList.add('is-hidden');
    $('cmSave').textContent='GUARDAR OPERACIÓN';syncForm();
  }
  async function save(e){
    e.preventDefault();if(loading)return;
    const data=payload();
    if(!data.driver_id){notice('Selecciona un piloto o contrato válido','error');return}
    if(ownerDriverIds().has(data.driver_id)){notice('Un Team Principal que corre en su propia escudería no necesita contrato ni cláusula.','error');return}
    const warning=data.kind==='import'?'La integración no generará cobros ni cargos adicionales.':'El importe se cobrará inmediatamente al equipo y los movimientos quedarán registrados.';
    if(!window.confirm('¿Guardar esta operación?\n\n'+warning+(editing?'\n\nSe sustituirá la operación anterior y se recalcularán sus efectos.':'')))return;
    $('cmSave').disabled=true;notice('Guardando operación…');
    try{
      const {data:result,error}=editing?
        await db.rpc('admin_contract_replace',{p_action_id:editing,p_data:data}):
        await db.rpc('admin_contract_apply',{p_data:data});
      if(error)throw error;
      cancelEdit();await reload();
      notice('Operación guardada correctamente. Identificador: '+result,'ok');
    }catch(err){console.error(err);notice('No se pudo guardar: '+(err.message||'error'),'error')}
    finally{$('cmSave').disabled=false}
  }

  function pickContract(id){
    const c=contractMap.get(id);if(!c)return;
    cancelEdit();
    $('cmKind').value=termMap.has(id)?'extend':'import';
    syncForm();$('cmContract').value=id;
    $('cmForm').scrollIntoView({behavior:'smooth',block:'start'});
    updatePreview();
  }
  function pickFree(id){
    cancelEdit();$('cmKind').value='new';syncForm();$('cmDriver').value=id;
    $('cmForm').scrollIntoView({behavior:'smooth',block:'start'});updatePreview();
  }
  function editAction(id){
    const a=actions.find(x=>x.id===id&&x.status==='active');if(!a)return;
    editing=a.id;
    const p=a.payload||{};
    $('cmKind').disabled=false;$('cmKind').value=p.kind;
    $('cmSeason').value=p.season||cfg.currentSeason;
    $('cmMoment').value=p.market_half??0;
    $('cmHalves').value=p.halves||2;
    $('cmAmount').value=p.amount||60;
    $('cmAllocation').value=p.allocation||'last';
    $('cmRound').value=p.start_round||6;
    $('cmDivision').value=p.division||'academy';
    syncForm();
    if(p.contract_id)$('cmContract').value=p.contract_id;
    if(p.driver_id)$('cmDriver').value=p.driver_id;
    if(p.team_id)$('cmTeam').value=p.team_id;
    $('cmKind').disabled=true;
    $('cmCancel').classList.remove('is-hidden');$('cmSave').textContent='GUARDAR CORRECCIÓN';
    $('cmForm').scrollIntoView({behavior:'smooth',block:'start'});updatePreview();
  }

  async function undoAction(id){
    const a=actions.find(x=>x.id===id&&x.status==='active');if(!a)return;
    if(!window.confirm('¿Eliminar y revertir esta operación de '+(driverMap.get(a.driver_id)?.nickname||'piloto')+'?\n\nSe revertirán sus pagos, sus cambios de contrato y, si corresponde, su cambio de escudería. El historial conservará la anotación.'))return;
    notice('Revirtiendo operación…');
    try{
      const {error}=await db.rpc('admin_contract_undo',{p_action_id:id});if(error)throw error;
      cancelEdit();await reload();notice('Operación revertida. Se restauraron los movimientos asociados.','ok');
    }catch(e){console.error(e);notice('No se pudo revertir: '+(e.message||'Error'),'error')}
  }

  $('cmReload').addEventListener('click',reload);
  $('cmSeason').addEventListener('change',()=>{render();});
  $('cmMoment').addEventListener('change',()=>{render();});
  $('cmSearch').addEventListener('input',renderActive);
  $('cmKind').addEventListener('change',syncForm);
  ['cmContract','cmDriver','cmTeam','cmHalves','cmAmount','cmAllocation','cmRound'].forEach(id=>$(id).addEventListener('input',updatePreview));
  $('cmForm').addEventListener('submit',save);
  $('cmCancel').addEventListener('click',cancelEdit);
  $('cmActiveBody').addEventListener('click',e=>{const btn=e.target.closest('[data-pick]');if(btn)pickContract(btn.dataset.pick);});
  $('cmFreeList').addEventListener('click',e=>{const btn=e.target.closest('[data-free]');if(btn)pickFree(btn.dataset.free);});
  $('cmHistory').addEventListener('click',e=>{const edit=e.target.closest('[data-edit]'),undo=e.target.closest('[data-undo]');if(edit&&!edit.disabled)editAction(edit.dataset.edit);if(undo&&!undo.disabled)undoAction(undo.dataset.undo);});
  const tab=document.querySelector('[data-admin-section="contratos"]');
  if(tab)tab.addEventListener('click',()=>{if(!initialized)reload()});
  if(window.location.hash==='#admin-contratos')reload();
})();