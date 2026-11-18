(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const roundSelect = $('prizeRound');
  if (!roundSelect) return;
  const config = window.HYPERDRIVE_CONFIG;
  const db = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {auth:{persistSession:true}});
  const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const money = value => Number(value).toLocaleString('es-ES') + ' M';
  const divisions = {hyperdrive:'Primera', academy:'Academy'};
  let version = 0;
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  for (let round=1; round<=12; round++) roundSelect.append(new Option('Ronda '+round,String(round)));
  async function resultFile(division, round, qualifying) {
    if (qualifying && config.currentSeason === 8 && round === 9) return null;
    const path = '../data/'+division+'_'+(qualifying?'qr':'r')+round+'.json';
    const response = await fetch(path,{cache:'no-cache'});
    if (response.status===404) return null;
    if (!response.ok) throw Error('No se pudo cargar '+path);
    const data = await response.json();
    if (Number(data.event?.round)!==round) throw Error('La ronda del resultado no coincide.');
    return data;
  }
  async function load() {
    loadHistory();
    const request = ++version;
    const round = Number(roundSelect.value);
    $('prizeCards').replaceChildren();
    $('prizePrevious').replaceChildren();
    $('prizeStatus').textContent = round?'Cargando resultados e ingresos…':'Selecciona una ronda.';
    if (!round) return;
    try {
      const responses = await Promise.all([
        db.from('drivers').select('id,nickname'),
        db.from('driver_result_aliases').select('driver_id,normalized_alias'),
        db.from('season_roster').select('driver_id,team_id,division,roster_status,start_round,end_round').eq('season_number',config.currentSeason),
        db.from('teams').select('id,name').eq('is_active',true).order('name'),
        db.from('staff_gp_prizes').select('*').eq('season_number',config.currentSeason).eq('round_number',round),
        db.from('team_accounts').select('id,team_id').eq('season_number',config.currentSeason),
        db.from('economic_transactions').select('account_id,description,amount_m,source_type').eq('round_number',round).eq('direction','income'),
        ...Object.keys(divisions).flatMap(division => [resultFile(division,round,false),resultFile(division,round,true)])
      ]);
      if (request!==version) return;
      const data = responses.slice(0,7).map(response => {if(response.error) throw response.error; return response.data||[];});
      const [drivers,aliases,roster,teams,paid,accounts,incomes] = data;
      const byName = new Map(drivers.map(driver => [norm(driver.nickname),driver.id]));
      aliases.forEach(alias => byName.set(alias.normalized_alias,alias.driver_id));
      const teamNames = new Map(teams.map(team => [team.id,team.name]));
      const accountTeams = new Map(accounts.map(account => [account.id,account.team_id]));
      const previous = incomes.filter(item => accountTeams.has(item.account_id) && item.source_type!=='staff_gp_prize');
      if (previous.length) {
        $('prizePrevious').append(element('h4','Ingresos anteriores de esta ronda'));
        $('prizePrevious').append(element('p','Comprueba los premios que ya hayas registrado manualmente antes de abonar.'));
        const list = element('ul');
        previous.forEach(item => list.append(element('li',(teamNames.get(accountTeams.get(item.account_id))||'Escudería')+' · '+item.description+' · '+money(item.amount_m))));
        $('prizePrevious').append(list);
      }
      Object.entries(divisions).forEach(([division,label],index) => {
        const race = responses[7+index*2];
        const qual = responses[8+index*2];
        for (const [type,file] of [['winner',race],['pole',qual]]) {
          const amount = division==='hyperdrive'?(type==='winner'?2:1):(type==='winner'?1:0.5);
          const title = label+' · '+(type==='winner'?'Ganador del GP':'Pole')+' · '+money(amount);
          const card = element('section',undefined,'prize-card');
          card.append(element('h4',title));
          $('prizeCards').append(card);
          const existing = paid.find(item => item.division===division && item.prize_type===type && !item.voided_at);
          if (existing) {
            card.append(element('p',existing.driver_name+' · '+(teamNames.get(existing.team_id)||'Escudería')));
            card.append(element('p','Abonado · '+money(existing.amount_m),'operation-status success'));
            continue;
          }
          if (type==='pole' && !file) {
            card.append(element('p','Sin premio pole por formato sin qualy.'));
            continue;
          }
          const info=file?.session?.sessionInfo;
          const row=file?.session?.drivers?.find(driver => Number(driver.classificationPosition??driver.position)===1);
          if (!row || info?.completedStatus!=='Completed') {
            card.append(element('p','Pendiente de resultados publicados.'));
            continue;
          }
          if ((type==='winner' && (info.sessionType!=='Race'||info.raceType!=='Main')) ||
              (type==='pole' && info.sessionType!=='Qualification')) {
            card.append(element('p','El archivo no corresponde a esta sesión del GP.'));
            continue;
          }
          const name = row.driverName;
          const driverId = byName.get(norm(name)) || null;
          const official = roster.filter(item => item.driver_id===driverId && item.division===division &&
            item.roster_status==='official' && item.start_round<=round && (item.end_round===null||item.end_round>=round))
            .sort((a,b)=>b.start_round-a.start_round)[0];
          card.append(element('p',name));
          const field=element('label',undefined,'op-field');
          field.append(element('span','Escudería que recibe el premio'));
          const select=element('select',undefined,'op-select');
          select.append(new Option('Selecciona escudería',''));
          teams.forEach(team => select.append(new Option(team.name,team.id)));
          if (official) { select.value=official.team_id; select.disabled=true; }
          field.append(select);
          card.append(field);
          if (!official) card.append(element('small','Reserva o piloto sin asiento oficial en esta ronda. Selecciona su escudería.'));
          const button=element('button','ABONAR '+money(amount),'primary-button');
          button.type='button';
          const status=element('p','','operation-status');
          status.setAttribute('role','status');
          button.addEventListener('click',async () => {
            if(button.disabled) return;
            if(!select.value) {status.textContent='Selecciona la escudería.'; return;}
            if(!window.confirm('¿Abonar '+money(amount)+' a '+teamNames.get(select.value)+'?\nR'+round+' · '+title+' · '+name+
              (previous.length?'\nRevisa los ingresos anteriores de esta ronda para evitar repetir un premio manual.':''))) return;
            button.disabled=true;
            status.textContent='Registrando premio…';
            try {
              const {error}=await db.rpc('staff_award_gp_prize',{
                p_season:config.currentSeason,p_round:round,p_division:division,p_type:type,
                p_driver_id:driverId,p_driver_name:name,p_team_id:select.value,
                p_result:{round,sessionInfo:info,driver:{driverName:name,classificationPosition:row.classificationPosition,position:row.position}}
              });
              if(error) throw error;
              status.textContent='Premio abonado.';
              if(request===version) await load();
            } catch(error) {
              status.textContent=error.message||'No se pudo confirmar el abono. Actualiza para comprobar su estado.';
              button.disabled=false;
            }
          });
          card.append(button,status);
        }
      });
      $('prizeStatus').textContent='Temporada '+config.currentSeason+' · Ronda '+round;
    } catch(error) {
      if(request===version) $('prizeStatus').textContent='No se pudieron cargar los premios. '+(error.message||'Reintenta.');
    }
  }

  let historyVersion = 0;
  async function loadHistory() {
    const request=++historyVersion;
    const body=$('prizeHistoryBody');
    const message=$('prizeHistoryStatus');
    message.textContent='Cargando histórico de premios…';
    try {
      const teamsResponse=await db.from('teams').select('id,name');
      if(teamsResponse.error) throw teamsResponse.error;
      const names=new Map(teamsResponse.data.map(team=>[team.id,team.name]));
      const records=[];
      for(let offset=0;;offset+=200){
        const response=await db.from('staff_gp_prizes').select('*')
          .eq('season_number',config.currentSeason).order('created_at',{ascending:false})
          .order('id',{ascending:false}).range(offset,offset+199);
        if(response.error) throw response.error;
        records.push(...response.data);
        if(response.data.length<200) break;
      }
      if(request!==historyVersion)return;
      body.replaceChildren();
      for(const prize of records){
        const row=element('tr');
        const date=new Intl.DateTimeFormat('es-ES',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Madrid'});
        for(const value of [
          date.format(new Date(prize.created_at)),
          'R'+prize.round_number,divisions[prize.division],
          prize.prize_type==='winner'?'Ganador GP':'Pole',
          prize.driver_name,names.get(prize.team_id)||'Escudería',
          money(prize.amount_m),
          prize.voided_at?'Deshecho · '+date.format(new Date(prize.voided_at)):'Abonado'
        ])row.append(element('td',value));
        const action=element('td');
        if(!prize.voided_at){
          const button=element('button','DESHACER','secondary-button');
          button.type='button';
          button.setAttribute('aria-label','Deshacer premio de '+prize.driver_name+' en R'+prize.round_number);
          button.addEventListener('click',async()=>{
            if(button.disabled)return;
            if(!window.confirm('¿Deshacer el premio de '+prize.driver_name+' en R'+prize.round_number+' ('+divisions[prize.division]+')?\nSe descontarán '+money(prize.amount_m)+' de '+(names.get(prize.team_id)||'la escudería')+' y podrás volver a abonarlo.'))return;
            button.disabled=true;
            message.textContent='Deshaciendo premio…';
            try{
              const {error}=await db.rpc('staff_undo_gp_prize',{p_prize_id:prize.id});
              if(error)throw error;
              await load();
            }catch(error){
              message.textContent='No se pudo confirmar la anulación. '+(error.message||'Actualiza el histórico.');
              button.disabled=false;
            }
          });
          action.append(button);
        }else action.textContent='—';
        row.append(action);
        body.append(row);
      }
      message.textContent=records.length+' registros · Temporada '+config.currentSeason+
        (records.length?'':' · Todavía no se han abonado premios desde este apartado.');
    }catch(error){
      if(request===historyVersion)message.textContent='No se pudo cargar el histórico. '+(error.message||'Reintenta.');
    }
  }
  document.querySelector('[data-operation-tab="prizes"]').addEventListener('click',loadHistory);
  $('prizeHistoryRefresh').addEventListener('click',loadHistory);

  roundSelect.addEventListener('change',load);
  $('prizeRefresh').addEventListener('click',load);
})();
