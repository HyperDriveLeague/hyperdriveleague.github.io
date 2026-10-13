(() => {
  'use strict';
  const config=window.HYPERDRIVE_CONFIG;
  const dialog=document.getElementById('seasonSanctionsDialog');
  const openButton=document.getElementById('showSeasonSanctions');
  if(!dialog||!openButton||!config||!window.supabase)return;

  const db=window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  const $=id=>document.getElementById(id);
  const body=$('seasonSanctionsBody');
  const count=$('seasonSanctionsCount');
  const input=$('seasonSanctionsSearch');
  const roundFilter=$('seasonSanctionsRound');
  let records=[],drivers=new Map(),teams=new Map(),loading=false,hasLoaded=false;
  const date=v=>v?new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'})
    .format(new Date(v+'T12:00:00')):'—';
  const normalize=value=>String(value??'').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-ES').trim();
  function setMessage(message,isError=false) {
    count.textContent=message;
    count.classList.toggle('error',isError);
  }
  function makeCell(row,content,classname='') {
    const td=document.createElement('td');
    td.textContent=content;
    if(classname)td.className=classname;
    row.appendChild(td);
    return td;
  }
  function empty(message) {
    body.replaceChildren();
    const tr=document.createElement('tr');
    makeCell(tr,message,'sanction-empty').colSpan=8;
    body.appendChild(tr);
  }
  function populateRounds() {
    const selected=roundFilter.value;
    const rounds=[...new Set(records.filter(x=>Number.isInteger(x.round_number)&&x.round_number>0)
      .map(x=>x.round_number))].sort((a,b)=>a-b);
    roundFilter.replaceChildren();
    const all=document.createElement('option');
    all.value='';
    all.textContent='Todas las rondas';
    roundFilter.appendChild(all);
    rounds.forEach(n=>{
      const option=document.createElement('option');
      option.value=String(n);
      option.textContent='Ronda '+n;
      roundFilter.appendChild(option);
    });
    roundFilter.value=rounds.some(n=>String(n)===selected)?selected:'';
  }
  function render() {
    if(!hasLoaded)return;
    const q=normalize(input.value);
    const selected=roundFilter.value;
    const filtered=records.filter(record=>{
      if(selected&&String(record.round_number)!==selected)return false;
      if(!q)return true;
      const pilot=drivers.get(record.driver_id);
      const team=teams.get(record.team_id);
      const beneficiary=teams.get(record.beneficiary_team_id);
      return normalize([
        pilot?.nickname,pilot?.race_number,
        team?.name,beneficiary?.name,
        record.article_code,record.description,record.seconds_text,
        record.points_text,record.round_number
      ].join(' ')).includes(q);
    });
    setMessage(filtered.length===records.length
      ?records.length+' sanción'+(records.length===1?'':'es')+' registrada'+(records.length===1?'':'s')+' en la temporada '+config.currentSeason
      :filtered.length+' de '+records.length+' sanciones · Temporada '+config.currentSeason);
    body.replaceChildren();
    if(!filtered.length) {
      empty(records.length?'No hay sanciones que coincidan con la búsqueda.':'Todavía no se han registrado sanciones esta temporada.');
      return;
    }
    const frag=document.createDocumentFragment();
    filtered.forEach(record=>{
      const row=document.createElement('tr');
      const driver=drivers.get(record.driver_id);
      const team=teams.get(record.team_id);
      const beneficiary=teams.get(record.beneficiary_team_id);
      makeCell(row,date(record.sanction_date));
      makeCell(row,record.round_number?'R'+record.round_number:'—');
      makeCell(row,(driver?.race_number!=null?'#'+driver.race_number+' ':'')+(driver?.nickname||'Piloto'),'driver-name');
      const teamCell=makeCell(row,team?.name||'—','team-name');
      if(beneficiary){
        const secondary=document.createElement('small');
        secondary.className='team-beneficiary';
        secondary.textContent='Beneficiada: '+beneficiary.name;
        teamCell.appendChild(secondary);
      }
      const article=makeCell(row,'');
      const tag=document.createElement('span');
      tag.className='sanction-article';
      tag.textContent=record.article_code||'—';
      article.appendChild(tag);
      makeCell(row,record.description||'—','sanction-description');
      makeCell(row,record.points_text||'—','sanction-points');
      makeCell(row,record.seconds_text||'—');
      frag.appendChild(row);
    });
    body.appendChild(frag);
  }
  async function loadAll(){
    if(loading)return;
    loading=true;
    hasLoaded=false;
    records=[];
    setMessage('Cargando todas las sanciones de la temporada '+config.currentSeason+'…');
    empty('Consultando historial completo…');
    try{
      const session=await db.auth.getSession();
      if(!session.data?.session)throw Error('Necesitas iniciar sesión para consultar el historial.');
      const permissions=await db.from('user_roles')
        .select('role').eq('user_id',session.data.session.user.id).in('role',['staff','admin']);
      if(permissions.error)throw permissions.error;
      if(!permissions.data?.length)throw Error('No tienes permisos de Staff para ver este historial.');

      const [driverResponse,teamResponse]=await Promise.all([
        db.from('drivers').select('id,nickname,race_number'),
        db.from('teams').select('id,name')
      ]);
      if(driverResponse.error)throw driverResponse.error;
      if(teamResponse.error)throw teamResponse.error;
      drivers=new Map((driverResponse.data||[]).map(x=>[x.id,x]));
      teams=new Map((teamResponse.data||[]).map(x=>[x.id,x]));

      // PostgREST usually caps responses at 1,000 rows. Request every page
      // to guarantee that the full season is displayed even in future seasons.
      const pageSize=200;
      let offset=0;
      for(;;){
        const result=await db.from('staff_sporting_sanctions')
          .select('id,season_number,round_number,sanction_date,article_code,driver_id,team_id,beneficiary_team_id,seconds_text,points_text,description,created_at')
          .eq('season_number',config.currentSeason)
          .order('sanction_date',{ascending:false})
          .order('created_at',{ascending:false})
          .order('id',{ascending:false})
          .range(offset,offset+pageSize-1);
        if(result.error)throw result.error;
        const chunk=result.data||[];
        records.push(...chunk);
        if(chunk.length<pageSize)break;
        offset+=pageSize;
      }
      hasLoaded=true;
      populateRounds();
      render();
    }catch(error){
      console.error('Error al cargar sanciones de la temporada:',error);
      setMessage('No se pudo cargar el historial: '+(error?.message||'error de conexión'),true);
      empty('El historial no está disponible. Cierra y vuelve a abrir para reintentar.');
    }finally{
      loading=false;
    }
  }
  openButton.addEventListener('click',()=>{
    if(!dialog.open)dialog.showModal();
    input.value='';
    roundFilter.value='';
    loadAll();
  });
  $('closeSeasonSanctions').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  input.addEventListener('input',render);
  roundFilter.addEventListener('change',render);
})();