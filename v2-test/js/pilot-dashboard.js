(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const pilotView = document.getElementById('pilotView');
  if (!config || !pilotView || !window.supabase) return;

  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  let loading = false;
  let loadedDriver = null;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key = v => String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const pts = v => Number.isInteger(num(v)) ? String(num(v)) : new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format(num(v));
  const money = v => v == null ? '—' : `${new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format(Number(v))} M`;
  const pos = v => num(v) > 0 ? `P${num(v)}` : '—';
  const dateShort = v => {
    if (!v) return '—';
    const d = new Date(String(v).includes('T') ? v : `${v}T12:00:00`);
    return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'short'}).format(d);
  };

  function buildShell() {
    if (document.getElementById('pilotSportDashboard')) return;
    const hero = pilotView.querySelector('.pilot-hero');
    if (!hero) return;
    const shell = document.createElement('div');
    shell.id = 'pilotSportDashboard';
    shell.className = 'pilot-sport-dashboard';
    shell.innerHTML = `
      <section class="module-section-heading pilot-dashboard-heading"><div><span class="eyebrow">TEMPORADA ${esc(config.currentSeason)}</span><h2>Resumen deportivo</h2></div><span id="pilotDataState" class="system-indicator">CARGANDO</span></section>
      <section id="pilotChampionshipCards" class="pilot-championship-grid">
        <article class="pilot-standing-card"><span>MUNDIAL DE PILOTOS</span><strong>—</strong><small>Cargando…</small></article>
        <article class="pilot-standing-card"><span>CONSTRUCTORES</span><strong>—</strong><small>Cargando…</small></article>
        <article class="pilot-standing-card featured"><span>SUPERCONSTRUCTORES</span><strong>—</strong><small>Cargando…</small></article>
      </section>
      <section class="module-section-heading pilot-dashboard-subheading"><div><span class="eyebrow">ESTADÍSTICAS</span><h2>Temporada actual</h2></div></section>
      <section id="pilotSeasonStats" class="pilot-season-stats"><div class="pilot-dashboard-loading">Cargando estadísticas…</div></section>
      <section class="module-section-heading pilot-dashboard-subheading"><div><span class="eyebrow">RESULTADOS</span><h2>Últimas carreras</h2></div><span id="pilotResultsDivision" class="season-badge">—</span></section>
      <section id="pilotRecentRaces" class="pilot-recent-races"><div class="pilot-dashboard-loading">Cargando resultados…</div></section>
      <section class="pilot-contract-objectives-grid">
        <div><section class="module-section-heading pilot-dashboard-subheading"><div><span class="eyebrow">CONTRATO</span><h2>Situación contractual</h2></div></section><section id="pilotContractCard" class="pilot-contract-card"><div class="pilot-dashboard-loading">Cargando contrato…</div></section></div>
        <div><section class="module-section-heading pilot-dashboard-subheading"><div><span class="eyebrow">ESCUDERÍA</span><h2>Objetivos de la división</h2></div></section><section id="pilotObjectives" class="pilot-objectives"><div class="pilot-dashboard-loading">Cargando objetivos…</div></section></div>
      </section>`;
    hero.insertAdjacentElement('afterend', shell);
  }

  async function getJSON(path) {
    try {
      const r = await fetch(path,{cache:'no-store'});
      return r.ok ? await r.json() : null;
    } catch (_) { return null; }
  }

  function officialSet(data, division) {
    const list = Array.isArray(data?.[division]) ? data[division] : [];
    return new Set(list.map(x => key(typeof x === 'string' ? x : (x?.driverName ?? x?.name))).filter(Boolean));
  }

  function driversTable(data, officials) {
    const list = Array.isArray(data?.seasonStatistics?.driverStandings) ? data.seasonStatistics.driverStandings : [];
    return list.filter(d => !officials.size || officials.has(key(d.driverName))).sort((a,b)=>num(a.position)-num(b.position)).map((d,i)=>({...d,dashboardPosition:i+1}));
  }

  function teamsTable(data) {
    const list = Array.isArray(data?.seasonStatistics?.teamStandings) ? data.seasonStatistics.teamStandings : [];
    return [...list].sort((a,b)=>num(a.position)-num(b.position)).map((t,i)=>({...t,dashboardPosition:i+1}));
  }

  function superTable(hyperdrive, academy) {
    const map = new Map();
    [['hyperdrive',hyperdrive],['academy',academy]].forEach(([division,data]) => {
      teamsTable(data).forEach(t => {
        const k = key(t.teamName);
        if (!k) return;
        if (!map.has(k)) map.set(k,{teamName:t.teamName,hyperdrive:0,academy:0,total:0});
        const row = map.get(k);
        row[division] = num(t.points);
        row.total = row.hyperdrive + row.academy;
      });
    });
    return [...map.values()].sort((a,b)=>b.total-a.total || String(a.teamName).localeCompare(String(b.teamName),'es')).map((t,i)=>({...t,position:i+1}));
  }

  function renderChampionships(driverName, teamName, division, current, other, officials) {
    const dl = driversTable(current,officials);
    const tl = teamsTable(current);
    const driver = dl.find(d=>key(d.driverName)===key(driverName));
    const team = tl.find(t=>key(t.teamName)===key(teamName));
    const supers = superTable(division==='hyperdrive'?current:other,division==='academy'?current:other);
    const superTeam = supers.find(t=>key(t.teamName)===key(teamName));
    const label = division==='academy'?'ACADEMY':'HYPERDRIVE';
    document.getElementById('pilotChampionshipCards').innerHTML = `
      <article class="pilot-standing-card"><span>MUNDIAL DE PILOTOS</span><strong>${driver?pos(driver.dashboardPosition):'—'}</strong><small>${driver?`${pts(driver.points)} pts · ${esc(driverName)}`:'Sin datos'}</small></article>
      <article class="pilot-standing-card"><span>CONSTRUCTORES · ${label}</span><strong>${team?pos(team.dashboardPosition):'—'}</strong><small>${team?`${pts(team.points)} pts · ${esc(teamName)}`:'Sin datos'}</small></article>
      <article class="pilot-standing-card featured"><span>SUPERCONSTRUCTORES</span><strong>${superTeam?pos(superTeam.position):'—'}</strong><small>${superTeam?`${pts(superTeam.total)} pts · ${pts(superTeam.hyperdrive)} HD + ${pts(superTeam.academy)} AC`:'Sin datos'}</small></article>`;
    return {driver,team};
  }

  function renderSeason(driver) {
    const target = document.getElementById('pilotSeasonStats');
    if (!driver) { target.innerHTML='<div class="pilot-dashboard-empty">No hay estadísticas de temporada.</div>'; return; }
    const p=driver.positions||{}, part=driver.participation||{}, rd=driver.raceDetails||{};
    const rows=[
      ['PUNTOS',pts(driver.points)],['VICTORIAS',num(p.wins)],['PODIOS',num(p.podiums)],['POLES',num(p.polePositions)],['V. RÁPIDAS',num(p.fastestLaps)],
      ['MEDIA CARRERA',p.averageRacePosition?Number(p.averageRacePosition).toLocaleString('es-ES',{maximumFractionDigits:2}):'—'],
      ['MEDIA QUALY',p.averageQualPosition?Number(p.averageQualPosition).toLocaleString('es-ES',{maximumFractionDigits:2}):'—'],
      ['FINALIZADAS',part.racesParticipated?`${num(part.racesFinished)}/${num(part.racesParticipated)}`:'—'],['VUELTAS LIDERADAS',num(rd.totalLeadLaps)]
    ];
    target.innerHTML=rows.map(([l,v])=>`<article class="pilot-stat-card"><span>${esc(l)}</span><strong>${esc(v)}</strong></article>`).join('');
  }

  const mainRace = e => { const r=Array.isArray(e?.races)?e.races:[]; return r.find(x=>!/sprint/i.test(String(x.sessionName||'')))||r[r.length-1]||null; };
  const mainQual = e => { const q=Array.isArray(e?.qualifications)?e.qualifications:[]; return q.find(x=>!/sprint/i.test(String(x.sessionName||'')))||q[q.length-1]||null; };

  function richDriver(file, driverName) {
    const list = file?.session?.drivers;
    return Array.isArray(list) ? list.find(d=>key(d.driverName)===key(driverName)) || null : null;
  }

  function penaltySeconds(d) {
    const p=d?.penalties||{};
    if (p.totalPenaltyTimeSeconds != null) return num(p.totalPenaltyTimeSeconds);
    return num(p.inGamePenaltySeconds)+num(p.stewardPenaltySeconds);
  }

  function raceDetail(label,value) { return `<div><span>${esc(label)}</span><strong>${esc(value ?? '—')}</strong></div>`; }

  function renderRecent(driver, division, raceFiles) {
    const target=document.getElementById('pilotRecentRaces');
    document.getElementById('pilotResultsDivision').textContent=division==='academy'?'ACADEMY':'HYPERDRIVE';
    const events=Array.isArray(driver?.events)?[...driver.events].sort((a,b)=>num(b.roundNumber)-num(a.roundNumber)).slice(0,5):[];
    if(!events.length){target.innerHTML='<div class="pilot-dashboard-empty">Todavía no hay carreras registradas.</div>';return;}
    target.innerHTML=events.map(e=>{
      const race=mainRace(e), qual=mainQual(e), rich=richDriver(raceFiles.get(num(e.roundNumber)),driver.driverName);
      const gain=race?num(race.positionChange):0;
      const fastest=(e.races||[]).some(x=>x.isFastestLap);
      const sprint=(e.races||[]).find(x=>/sprint/i.test(String(x.sessionName||'')));
      const status=race?.isFinished===false?(race.status||'No finalizó'):(race?.status||'Finalizada');
      const richStats=[
        ['QUALY',qual?pos(qual.position):'—'],['PARRILLA',race?pos(race.gridPosition):'—'],['POSICIONES',race?(gain>0?`+${gain}`:String(gain)):'—'],['PUNTOS',pts(e.pointsEarned)],
        ['V. RÁPIDA',rich?.fastestLapTime||'—'],['VEL. MÁX.',rich?.raceDetails?.maxSpeed?`${rich.raceDetails.maxSpeed} km/h`:'—'],['RITMO',rich?.ratings?.pace?.rating||'—'],['CONSISTENCIA',rich?.ratings?.consistency?.rating||'—'],
        ['VUELTAS',rich?.lapsCompleted ?? '—'],['PENALIZACIÓN',penaltySeconds(rich)?`${penaltySeconds(rich)} s`:'0 s']
      ];
      return `<article class="pilot-race-card">
        <div class="pilot-race-head"><div><span>R${esc(e.roundNumber??'—')} · ${esc(dateShort(e.eventDate))}</span><h3>${esc(e.eventName||e.trackName||'Gran Premio')}</h3></div><strong class="pilot-race-position">${race?pos(race.position):'—'}</strong></div>
        <div class="pilot-race-stats pilot-race-stats-rich">${richStats.map(([l,v])=>raceDetail(l,v)).join('')}</div>
        <div class="pilot-race-tags"><span>${esc(status)}</span>${race&&num(race.gridPosition)===1?'<span class="accent">POLE +1</span>':''}${fastest?'<span class="purple">VUELTA RÁPIDA</span>':''}${sprint?`<span>SPRINT ${pos(sprint.position)}</span>`:''}</div>
      </article>`;
    }).join('');
  }

  function remaining(c) {
    if(!c)return'Sin contrato activo';
    if(c.contract_end_label)return c.contract_end_label;
    if(c.half_seasons_remaining==null)return'No informado';
    const h=num(c.half_seasons_remaining);
    if(h===0)return'Finaliza ahora'; if(h===1)return'½ temporada'; if(h%2===0)return`${h/2} temporada${h===2?'':'s'}`; return`${Math.floor(h/2)}½ temporadas`;
  }

  function renderContract(c,teamName){
    const t=document.getElementById('pilotContractCard');
    if(!c){t.innerHTML='<div class="pilot-dashboard-empty">No hay contrato activo registrado.</div>';return;}
    const f=v=>v?new Intl.DateTimeFormat('es-ES').format(new Date(`${v}T12:00:00`)):'—';
    const start=c.contract_start_label||f(c.start_date), end=c.contract_end_label||f(c.end_date);
    t.innerHTML=`<div class="pilot-contract-team"><span>ESCUDERÍA</span><strong>${esc(teamName||'—')}</strong></div><div class="pilot-contract-main"><span>CONTRATO RESTANTE</span><strong>${esc(remaining(c))}</strong></div><div class="pilot-contract-grid"><div><span>VALOR DEL PILOTO</span><strong>${money(c.driver_value_m)}</strong></div><div><span>CLÁUSULA</span><strong>${money(c.buyout_clause_m)}</strong></div><div><span>INICIO</span><strong>${esc(start)}</strong></div><div><span>FIN</span><strong>${esc(end)}</strong></div></div>${c.is_team_principal_contract?'<div class="pilot-contract-note">Contrato asociado a Team Principal.</div>':''}`;
  }

  const teamDrivers=(s,t)=>(s?.seasonStatistics?.driverStandings||[]).filter(d=>key(d.teamName)===key(t));
  const maxDriver=(list,fn)=>list.reduce((m,d)=>Math.max(m,num(fn(d))),0);
  function roundsFor(list){const m=new Map();list.forEach(d=>(d.events||[]).forEach(e=>{const r=num(e.roundNumber);if(!r)return;if(!m.has(r))m.set(r,[]);m.get(r).push({d,e,race:mainRace(e),qual:mainQual(e)});}));return[...m.entries()].sort((a,b)=>a[0]-b[0]);}
  function driverStreak(list,pred){let best=0;list.forEach(d=>{let s=0;[...(d.events||[])].sort((a,b)=>num(a.roundNumber)-num(b.roundNumber)).forEach(e=>{s=pred(e,d)?s+1:0;best=Math.max(best,s);});});return best;}
  function roundStreak(rounds,pred){let best=0,s=0,last=null;rounds.forEach(([r,rows])=>{if(last!=null&&r!==last+1)s=0;s=pred(rows)?s+1:0;best=Math.max(best,s);last=r;});return best;}

  function evalObjective(text,dbDone,standings,teamName,teamStanding){
    if(dbDone)return{status:'completed',label:'CUMPLIDO',progress:'Marcado como cumplido en Race Control'};
    const q=String(text||'').toLowerCase(), list=teamDrivers(standings,teamName), rounds=roundsFor(list), ended=!!standings?.seasonStatistics?.status?.isCompleted, teamPos=num(teamStanding?.dashboardPosition||teamStanding?.position);
    const progress=(cur,target,prefix='')=>({status:cur>=target?'completed':'pending',label:cur>=target?'CUMPLIDO':'PENDIENTE',progress:`${prefix}${cur}/${target}`});
    const final=(ok,p)=>({status:ended&&ok?'completed':'pending',label:ended&&ok?'CUMPLIDO':'PENDIENTE',progress:p});
    let m;
    if(/ganar el campeonato de constructores/.test(q))return final(teamPos===1,teamPos?`Posición actual: P${teamPos}`:'Sin clasificación');
    if((m=q.match(/entre los (\d+) primeros.*constructores/)))return final(teamPos>0&&teamPos<=num(m[1]),teamPos?`Posición actual: P${teamPos} · objetivo Top ${m[1]}`:'Sin clasificación');
    if((m=q.match(/entre los (\d+) primeros del campeonato de constructores/)))return final(teamPos>0&&teamPos<=num(m[1]),teamPos?`Posición actual: P${teamPos} · objetivo Top ${m[1]}`:'Sin clasificación');
    if((m=q.match(/sumar más de (\d+) puntos en un mismo gp/))){const best=rounds.reduce((mx,[,rows])=>Math.max(mx,rows.reduce((s,x)=>s+num(x.e.pointsEarned),0)),0);return progress(best,num(m[1])+1,'Mejor GP: ');}
    if((m=q.match(/sumar (?:más de|al menos) (\d+) puntos en la temporada.*piloto/))){const target=/más de/.test(q)?num(m[1])+1:num(m[1]);return progress(maxDriver(list,d=>d.points),target,'Mejor piloto: ');}
    if((m=q.match(/(?:ganar|lograr al menos) (\d+) (?:carreras|victorias).*piloto/)))return progress(maxDriver(list,d=>d.positions?.wins),num(m[1]),'Mejor piloto: ');
    if((m=q.match(/(?:conseguir|al menos) (?:al menos )?(\d+) podios.*piloto/)))return progress(maxDriver(list,d=>d.positions?.podiums),num(m[1]),'Mejor piloto: ');
    if((m=q.match(/(?:conseguir|al menos) (?:al menos )?(\d+) poles.*piloto/)))return progress(maxDriver(list,d=>d.positions?.polePositions),num(m[1]),'Mejor piloto: ');
    if(/al menos una pole/.test(q))return progress(maxDriver(list,d=>d.positions?.polePositions),1,'Poles: ');
    if((m=q.match(/top (\d+) en al menos (\d+) carreras.*piloto/))){const best=list.reduce((mx,d)=>Math.max(mx,(d.events||[]).filter(e=>num(mainRace(e)?.position)<=num(m[1])&&mainRace(e)).length),0);return progress(best,num(m[2]),'Mejor piloto: ');}
    if(/al menos 1 top 8/.test(q)){const best=list.reduce((mx,d)=>Math.max(mx,(d.events||[]).filter(e=>mainRace(e)&&num(mainRace(e).position)<=8).length),0);return progress(best,1,'Top 8: ');}
    if((m=q.match(/racha de (\d+) carreras seguidas en puntos.*piloto/)))return progress(driverStreak(list,e=>num(e.pointsEarned)>0),num(m[1]),'Mejor racha: ');
    if((m=q.match(/puntos en (\d+) carreras consecutivas.*piloto/)))return progress(driverStreak(list,e=>num(e.pointsEarned)>0),num(m[1]),'Mejor racha: ');
    if((m=q.match(/ganar (\d+) carreras consecutivas.*piloto/)))return progress(driverStreak(list,e=>num(mainRace(e)?.position)===1),num(m[1]),'Mejor racha: ');
    if((m=q.match(/conseguir (\d+) vueltas rápidas/)))return progress(maxDriver(list,d=>d.positions?.fastestLaps),num(m[1]),'Mejor piloto: ');
    if(/vuelta rápida$/.test(q))return progress(maxDriver(list,d=>d.positions?.fastestLaps),1,'Vueltas rápidas: ');
    if(/hacer dos doble podio/.test(q)){const c=rounds.filter(([,r])=>r.filter(x=>x.race&&num(x.race.position)<=3).length>=2).length;return progress(c,2,'Dobles podios: ');}
    if(/lograr un podio con ambos pilotos/.test(q))return progress(list.filter(d=>num(d.positions?.podiums)>0).length,2,'Pilotos con podio: ');
    if((m=q.match(/al menos (\d+) doble top (\d+)/))){const c=rounds.filter(([,r])=>r.filter(x=>x.race&&num(x.race.position)<=num(m[2])).length>=2).length;return progress(c,num(m[1]),`Dobles Top ${m[2]}: `);}
    if((m=q.match(/puntos con ambos coches en (\d+) carreras/))){const c=rounds.filter(([,r])=>r.filter(x=>num(x.e.pointsEarned)>0).length>=2).length;return progress(c,num(m[1]),'Dobles puntuaciones: ');}
    if((m=q.match(/puntos en al menos (\d+) carreras.*equipo/))){const c=rounds.filter(([,r])=>r.some(x=>num(x.e.pointsEarned)>0)).length;return progress(c,num(m[1]),'GP puntuando: ');}
    if((m=q.match(/primera fila al menos (\d+) veces/))){const c=rounds.reduce((s,[,r])=>s+r.filter(x=>x.qual&&num(x.qual.position)<=2).length,0);return progress(c,num(m[1]),'Primeras filas: ');}
    if((m=q.match(/clasificar al menos (\d+) veces en el top (\d+)/))){const c=rounds.reduce((s,[,r])=>s+r.filter(x=>x.qual&&num(x.qual.position)<=num(m[2])).length,0);return progress(c,num(m[1]),`Qualys Top ${m[2]}: `);}
    if(/clasificar en el top 10 una vez/.test(q)){const c=rounds.reduce((s,[,r])=>s+r.filter(x=>x.qual&&num(x.qual.position)<=10).length,0);return progress(c,1,'Top 10 en qualy: ');}
    if((m=q.match(/top (\d+) en clasificación en (\d+) (?:gp|carreras)/))){const c=rounds.filter(([,r])=>r.some(x=>x.qual&&num(x.qual.position)<=num(m[1]))).length;return progress(c,num(m[2]),`GP con Top ${m[1]} en qualy: `);}
    if((m=q.match(/mejorar posición de salida en al menos (\d+) carreras/))){const best=list.reduce((mx,d)=>Math.max(mx,(d.events||[]).filter(e=>num(mainRace(e)?.positionChange)>0).length),0);return progress(best,num(m[1]),'Mejor piloto: ');}
    if((m=q.match(/racha de (\d+) carreras consecutivas sumando puntos/)))return progress(roundStreak(rounds,r=>r.some(x=>num(x.e.pointsEarned)>0)),num(m[1]),'Racha del equipo: ');
    const completed=num(standings?.season?.completedRounds||rounds.length);
    if(/todas las carreras con al menos un coche en puntos/.test(q)){const c=rounds.filter(([,r])=>r.some(x=>num(x.e.pointsEarned)>0)).length;return final(ended&&c===completed,`Cumplidas hasta ahora: ${c}/${completed}`);}
    if(/todas las carreras con al menos un coche en meta/.test(q)){const c=rounds.filter(([,r])=>r.some(x=>x.race?.isFinished!==false)).length;return final(ended&&c===completed,`Cumplidas hasta ahora: ${c}/${completed}`);}
    if(/sin doble abandono/.test(q)){const c=rounds.filter(([,r])=>r.filter(x=>x.race?.isFinished===false).length>=2).length;return final(ended&&c===0,`Dobles abandonos: ${c}`);}
    if((m=q.match(/no abandonar más de (\d+) carreras/))){const d=list.reduce((s,x)=>s+num(x.penalties?.dnfCount),0);return final(ended&&d<=num(m[1]),`Abandonos: ${d}/${m[1]} máx.`);}
    if((m=q.match(/terminar (?:al menos )?(\d+)% de las carreras con ambos coches/))){const c=rounds.filter(([,r])=>r.filter(x=>x.race?.isFinished!==false).length>=2).length,pct=completed?Math.round(c/completed*100):0;return final(ended&&pct>=num(m[1]),`Actual: ${pct}% · objetivo ${m[1]}%`);}
    return{status:'pending',label:'PENDIENTE',progress:'Seguimiento manual / cierre de temporada'};
  }

  function renderObjectives(items,standings,teamName,teamStanding){
    const t=document.getElementById('pilotObjectives');
    if(!Array.isArray(items)||!items.length){t.innerHTML='<div class="pilot-dashboard-empty">No hay objetivos activos para esta división.</div>';return;}
    t.innerHTML=items.map(x=>{const e=evalObjective(x.objective,x.is_completed,standings,teamName,teamStanding);return`<article class="pilot-objective-card ${e.status}"><div class="pilot-objective-top"><div><span>#${esc(x.sponsor_number)} · ${esc(x.name)}</span><strong>${money(x.effective_reward_m)}</strong></div><span class="pilot-objective-state">${esc(e.label)}</span></div><p>${esc(x.objective)}</p><small>${esc(e.progress)}</small></article>`;}).join('');
  }

  async function load(){
    if(loading||pilotView.classList.contains('is-hidden'))return;
    loading=true;buildShell();const state=document.getElementById('pilotDataState');if(state){state.textContent='CARGANDO';state.classList.remove('ok');}
    try{
      const {data:{session}}=await client.auth.getSession();if(!session)return;
      const pr=await client.from('profiles').select('driver_id,drivers:driver_id(id,nickname,race_number)').eq('id',session.user.id).maybeSingle();if(pr.error)throw pr.error;
      const d=pr.data?.drivers;if(!d?.id)throw new Error('No hay piloto vinculado.');if(loadedDriver===d.id&&document.getElementById('pilotChampionshipCards')?.dataset.loaded==='1')return;
      const priv=await client.rpc('pilot_dashboard_private',{p_season_number:config.currentSeason});if(priv.error)throw priv.error;const pd=priv.data||{};
      const division=String(pd.division||'').toLowerCase(), teamName=pd.team_name||'';if(!['academy','hyperdrive'].includes(division))throw new Error('Sin división activa.');const other=division==='academy'?'hyperdrive':'academy';
      const [standings,otherStandings,officials]=await Promise.all([getJSON(`/data/${division}-standings.json`),getJSON(`/data/${other}-standings.json`),getJSON('/data/official-drivers.json')]);if(!standings)throw new Error('No se pudo cargar la clasificación.');
      const champ=renderChampionships(d.nickname,teamName,division,standings,otherStandings,officialSet(officials,division));renderSeason(champ.driver);
      const recent=Array.isArray(champ.driver?.events)?[...champ.driver.events].sort((a,b)=>num(b.roundNumber)-num(a.roundNumber)).slice(0,5):[];
      const files=new Map();await Promise.all(recent.map(async e=>{const round=num(e.roundNumber);const f=await getJSON(`/data/${division}_r${round}.json`);if(f)files.set(round,f);}));
      renderRecent(champ.driver,division,files);renderContract(pd.contract,teamName);renderObjectives(pd.objectives,standings,teamName,champ.team);
      const cards=document.getElementById('pilotChampionshipCards');if(cards)cards.dataset.loaded='1';loadedDriver=d.id;if(state){state.textContent='ACTUALIZADO';state.classList.add('ok');}
    }catch(error){console.error('Pilot dashboard error:',error);if(state){state.textContent='REVISAR';state.classList.remove('ok');}['pilotChampionshipCards','pilotSeasonStats','pilotRecentRaces','pilotContractCard','pilotObjectives'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML='<div class="pilot-dashboard-empty">No se pudieron cargar estos datos.</div>';});}
    finally{loading=false;}
  }

  buildShell();
  new MutationObserver(()=>{if(!pilotView.classList.contains('is-hidden'))setTimeout(load,30);}).observe(pilotView,{attributes:true,attributeFilter:['class']});
  if(!pilotView.classList.contains('is-hidden'))load();
})();