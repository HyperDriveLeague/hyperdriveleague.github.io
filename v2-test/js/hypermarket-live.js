/* Live Team Principal HyperMarket bootstrap. Read-only: requests a scoped
   authorized snapshot, then starts the local simulator with that baseline. */
(() => {
  'use strict';
  const gate=document.getElementById('marketGate');
  const gateText=document.getElementById('marketGateMessage');
  const app=document.getElementById('marketApp');
  const config=window.HYPERDRIVE_CONFIG;
  const get=id=>document.getElementById(id);
  const money=value=>Number(value||0).toLocaleString('es-ES',{
    minimumFractionDigits:2,maximumFractionDigits:2
  });

  function fail(message){
    app.hidden=true;
    gate.hidden=false;
    gateText.textContent=message;
  }

  function renderRoster(records,teamName){
    get('liveRosterHeader').textContent='PLANTILLA · '+String(teamName||'').toUpperCase();
    const roster=get('liveRosterList');
    roster.replaceChildren();
    if(!Array.isArray(records)||records.length===0){
      const note=document.createElement('p');
      note.textContent='No se han encontrado pilotos oficiales activos.';
      roster.appendChild(note);
      return;
    }
    const divisionLabel=v=>v==='academy'?'Academy':v==='hyperdrive'?'HyperDrive':v||'';
    // Each row is generated from the authenticated team's roster; never inject
    // source text as HTML.
    for(const driver of [...records].sort((a,b)=>{
      const order={hyperdrive:0,academy:1};
      return (order[a.division]??2)-(order[b.division]??2)
        ||String(a.name||'').localeCompare(String(b.name||''),'es');
    })){
      const line=document.createElement('div');
      const name=document.createElement('span');
      name.appendChild(document.createTextNode(
        '#'+(driver.race_number??'—')+' '+(driver.name||'Piloto')
      ));
      const division=document.createElement('small');
      division.textContent=divisionLabel(driver.division);
      name.appendChild(division);
      const cap=document.createElement('strong');
      cap.textContent=driver.owner?'EXENTO'
        :driver.cap_value_m==null?'SIN CONTRATO'
        :money(driver.cap_value_m)+' M';
      line.append(name,cap);
      if(driver.owner)line.classList.add('owner');
      roster.appendChild(line);
    }
  }

  function requireMoney(value,field){
    const number=Number(value);
    if(value===null||value===undefined||!Number.isFinite(number))
      throw new Error('El banco no ha facilitado un valor válido para '+field+'.');
    return number;
  }

  function loadCalculator(){
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='labs/hypermarket.js?v=3';
      script.onload=resolve;
      script.onerror=()=>reject(new Error('No se ha podido cargar el simulador.'));
      document.body.appendChild(script);
    });
  }

  async function init(){
    if(!config?.supabaseUrl||!window.supabase){
      fail('No se ha podido inicializar la conexión segura. Recarga la página.');
      return;
    }
    const client=window.supabase.createClient(
      config.supabaseUrl,config.supabasePublishableKey,
      {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
    );
    try{
      const session=await client.auth.getUser();
      if(session.error||!session.data?.user){
        fail('Debes iniciar sesión en el Control Center para utilizar esta herramienta.');
        return;
      }

      // The server validates that only admins can use preview_team. A regular
      // Team Principal cannot request another team's bank by editing the URL.
      const previewTeamId=new URLSearchParams(window.location.search).get('preview_team');
      const response=await client.rpc('team_market_simulator_snapshot',{
        p_preview_team_id:previewTeamId||null
      });
      if(response.error)throw response.error;
      const data=response.data;
      if(!data?.team_id||!data?.team_name)
        throw new Error('No se han encontrado datos de la escudería.');

      const base={
        balance:requireMoney(data.net_balance_m,'el saldo'),
        capUsed:requireMoney(data.salary_cap_used_m,'el salary cap'),
        capLimit:requireMoney(data.salary_cap_limit_m,'el límite salarial'),
        reserved:requireMoney(data.reserved_outgoing_m,'los importes reservados'),
        profit:requireMoney(data.season_profit_m,'el resultado económico'),
        marketHalf:1
      };
      if(base.capLimit<=0)throw new Error('El límite salarial no es válido.');
      // The financial values and roster are scoped to the caller on the server.
      window.HYPERMARKET_INITIAL_DATA=base;
      get('liveTeamName').textContent=data.team_name;
      get('liveTeamEmblem').textContent=String(data.team_name).slice(0,1).toUpperCase();
      get('liveSnapshotTime').textContent='BANCO EN VIVO · CONSULTADO '+new Intl.DateTimeFormat('es-ES',{
        day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'
      }).format(new Date(data.retrieved_at||Date.now()));
      renderRoster(data.roster,data.team_name);
      const back=get('backTeamLink');
      if(previewTeamId&&back)back.href='team.html?preview_team='+encodeURIComponent(previewTeamId);
      await loadCalculator();
      gate.hidden=true;
      app.hidden=false;
    }catch(error){
      console.error('HyperMarket: no se pudo obtener el banco autorizado',error);
      fail(error?.message||'No se ha podido cargar el banco de tu escudería.');
    }
  }
  init();
})();
