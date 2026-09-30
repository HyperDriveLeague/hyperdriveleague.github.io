(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const pilotView = document.getElementById('pilotView');
  if (!config || !pilotView || !window.supabase) return;

  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  let loading = false;
  let loadedForDriver = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalize = value => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const fmtPoints = value => Number.isInteger(n(value)) ? String(n(value)) : new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format(n(value));
  const fmtMoney = value => value == null ? '—' : `${new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format(Number(value))} M`;
  const fmtPos = value => Number(value) > 0 ? `P${Number(value)}` : '—';
  const fmtDate = value => {
    if (!value) return '—';
    const date = new Date(value.includes?.('T') ? value : `${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'short'}).format(date);
  };

  function buildShell() {
    if (document.getElementById('pilotSportDashboard')) return;
    const hero = pilotView.querySelector('.pilot-hero');
    if (!hero) return;

    const shell = document.createElement('div');
    shell.id = 'pilotSportDashboard';
    shell.className = 'pilot-sport-dashboard';
    shell.innerHTML = `
      <section class="module-section-heading pilot-dashboard-heading">
        <div><span class="eyebrow">TEMPORADA ${esc(config.currentSeason)}</span><h2>Resumen deportivo</h2></div>
        <span id="pilotDataState" class="system-indicator">CARGANDO</span>
      </section>
      <section id="pilotChampionshipCards" class="pilot-championship-grid">
        <article class="pilot-standing-card"><span>MUNDIAL DE PILOTOS</span><strong>—</strong><small>Cargando clasificación…</small></article>
        <article class="pilot-standing-card"><span>CONSTRUCTORES</span><strong>—</strong><small>Cargando clasificación…</small></article>
        <article class="pilot-standing-card featured"><span>SUPERCONSTRUCTORES</span><strong>—</strong><small>Cargando clasificación…</small></article>
      </section>

      <section class="module-section-heading pilot-dashboard-subheading"><div><span class="eyebrow">ESTADÍSTICAS</span><h2>Temporada actual</h2></div></section>
      <section id="pilotSeasonStats" class="pilot-season-stats"><div class="pilot-dashboard-loading">Cargando estadísticas…</div></section>

      <section class="module-section-heading pilot-dashboard-subheading"><div><span class="eyebrow">RESULTADOS</span><h2>Últimas carreras</h2></div><span id="pilotResultsDivision" class="season-badge">—</span></section>
      <section id="pilotRecentRaces" class="pilot-recent-races"><div class="pilot-dashboard-loading">Cargando resultados…</div></section>

      <section class="pilot-contract-objectives-grid">
        <div>
          <section class="module-section-heading pilot-dashboard-subheading"><div><span class="eyebrow">CONTRATO</span><h2>Situación contractual</h2></div></section>
          <section id="pilotContractCard" class="pilot-contract-card"><div class="pilot-dashboard-loading">Cargando contrato…</div></section>
        </div>
        <div>
          <section class="module-section-heading pilot-dashboard-subheading"><div><span class="eyebrow">ESCUDERÍA</span><h2>Objetivos de la división</h2></div></section>
          <section id="pilotObjectives" class="pilot-objectives"><div class="pilot-dashboard-loading">Cargando objetivos…</div></section>
        </div>
      </section>`;

    hero.insertAdjacentElement('afterend', shell);
  }

  async function fetchJSON(path) {
    try {
      const response = await fetch(path, { cache:'no-store' });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.warn('Pilot dashboard: no se pudo cargar', path, error);
      return null;
    }
  }

  function officialDriverSet(data, division) {
    const list = Array.isArray(data?.[division]) ? data[division] : [];
    return new Set(list.map(item => normalize(typeof item === 'string' ? item : (item?.driverName ?? item?.name ?? ''))).filter(Boolean));
  }

  function driverPoleBonus(driver) {
    return n(driver?.positions?.polePositions);
  }

  function adjustedDriverStandings(standings, officials) {
    const list = Array.isArray(standings?.seasonStatistics?.driverStandings) ? standings.seasonStatistics.driverStandings : [];
    return list
      .filter(driver => !officials.size || officials.has(normalize(driver.driverName)))
      .map(driver => ({...driver, adjustedPoints:n(driver.points) + driverPoleBonus(driver)}))
      .sort((a,b) => b.adjustedPoints - a.adjustedPoints || n(a.position) - n(b.position) || String(a.driverName).localeCompare(String(b.driverName),'es'))
      .map((driver,index) => ({...driver, adjustedPosition:index+1}));
  }

  function adjustedTeamStandings(standings) {
    const teams = Array.isArray(standings?.seasonStatistics?.teamStandings) ? standings.seasonStatistics.teamStandings : [];
    const drivers = Array.isArray(standings?.seasonStatistics?.driverStandings) ? standings.seasonStatistics.driverStandings : [];
    const poleByTeam = new Map();
    drivers.forEach(driver => {
      const key = normalize(driver.teamName);
      if (!key) return;
      poleByTeam.set(key, (poleByTeam.get(key) || 0) + driverPoleBonus(driver));
    });
    return teams
      .map(team => ({...team, adjustedPoints:n(team.points) + (poleByTeam.get(normalize(team.teamName)) || 0)}))
      .sort((a,b) => b.adjustedPoints - a.adjustedPoints || n(a.position) - n(b.position) || String(a.teamName).localeCompare(String(b.teamName),'es'))
      .map((team,index) => ({...team, adjustedPosition:index+1}));
  }

  function superconstructorStandings(hyperdrive, academy) {
    const map = new Map();
    [adjustedTeamStandings(hyperdrive), adjustedTeamStandings(academy)].forEach((list,divisionIndex) => {
      const division = divisionIndex === 0 ? 'hyperdrive' : 'academy';
      list.forEach(team => {
        const key = normalize(team.teamName);
        if (!key) return;
        if (!map.has(key)) map.set(key,{teamName:team.teamName,hyperdrive:0,academy:0,total:0});
        const row = map.get(key);
        row[division] = team.adjustedPoints;
        row.total = row.hyperdrive + row.academy;
      });
    });
    return [...map.values()].sort((a,b) => b.total-a.total || String(a.teamName).localeCompare(String(b.teamName),'es')).map((team,index)=>({...team,position:index+1}));
  }

  function renderChampionships(driverName, teamName, division, currentStandings, otherStandings, officials) {
    const grid = document.getElementById('pilotChampionshipCards');
    const driverList = adjustedDriverStandings(currentStandings, officials);
    const driver = driverList.find(item => normalize(item.driverName) === normalize(driverName));
    const teamList = adjustedTeamStandings(currentStandings);
    const team = teamList.find(item => normalize(item.teamName) === normalize(teamName));
    const hyperdrive = division === 'hyperdrive' ? currentStandings : otherStandings;
    const academy = division === 'academy' ? currentStandings : otherStandings;
    const superList = superconstructorStandings(hyperdrive, academy);
    const superTeam = superList.find(item => normalize(item.teamName) === normalize(teamName));
    const divisionLabel = division === 'academy' ? 'Academy' : 'HyperDrive';

    grid.innerHTML = `
      <article class="pilot-standing-card">
        <span>MUNDIAL DE PILOTOS</span>
        <strong>${driver ? fmtPos(driver.adjustedPosition) : '—'}</strong>
        <small>${driver ? `${fmtPoints(driver.adjustedPoints)} pts · ${esc(driverName)}` : 'Sin datos de clasificación'}</small>
      </article>
      <article class="pilot-standing-card">
        <span>CONSTRUCTORES · ${esc(divisionLabel.toUpperCase())}</span>
        <strong>${team ? fmtPos(team.adjustedPosition) : '—'}</strong>
        <small>${team ? `${fmtPoints(team.adjustedPoints)} pts · ${esc(teamName)}` : 'Sin datos de clasificación'}</small>
      </article>
      <article class="pilot-standing-card featured">
        <span>SUPERCONSTRUCTORES</span>
        <strong>${superTeam ? fmtPos(superTeam.position) : '—'}</strong>
        <small>${superTeam ? `${fmtPoints(superTeam.total)} pts · ${fmtPoints(superTeam.hyperdrive)} HD + ${fmtPoints(superTeam.academy)} AC` : 'Sin datos de clasificación'}</small>
      </article>`;

    return { driver, driverList, team, teamList, superTeam, superList };
  }

  function renderSeasonStats(driver) {
    const target = document.getElementById('pilotSeasonStats');
    if (!driver) {
      target.innerHTML = '<div class="pilot-dashboard-empty">No hay estadísticas de temporada para este piloto.</div>';
      return;
    }
    const p = driver.positions || {};
    const participation = driver.participation || {};
    const details = driver.raceDetails || {};
    const stats = [
      ['PUNTOS', fmtPoints(n(driver.points) + driverPoleBonus(driver))],
      ['VICTORIAS', n(p.wins)],
      ['PODIOS', n(p.podiums)],
      ['POLES', n(p.polePositions)],
      ['V. RÁPIDAS', n(p.fastestLaps)],
      ['MEDIA CARRERA', p.averageRacePosition ? Number(p.averageRacePosition).toLocaleString('es-ES',{maximumFractionDigits:2}) : '—'],
      ['MEDIA QUALY', p.averageQualPosition ? Number(p.averageQualPosition).toLocaleString('es-ES',{maximumFractionDigits:2}) : '—'],
      ['FINALIZADAS', participation.racesParticipated ? `${n(participation.racesFinished)}/${n(participation.racesParticipated)}` : '—'],
      ['VUELTAS LIDERADAS', n(details.totalLeadLaps)]
    ];
    target.innerHTML = stats.map(([label,value]) => `<article class="pilot-stat-card"><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`).join('');
  }

  function getMainRace(event) {
    const races = Array.isArray(event?.races) ? event.races : [];
    return races.find(race => !/sprint/i.test(String(race.sessionName || ''))) || races[races.length-1] || null;
  }

  function getQual(event) {
    const qualifications = Array.isArray(event?.qualifications) ? event.qualifications : [];
    return qualifications.find(q => !/sprint/i.test(String(q.sessionName || ''))) || qualifications[qualifications.length-1] || null;
  }

  function renderRecentRaces(driver, division) {
    const target = document.getElementById('pilotRecentRaces');
    document.getElementById('pilotResultsDivision').textContent = division === 'academy' ? 'ACADEMY' : 'HYPERDRIVE';
    const events = Array.isArray(driver?.events) ? [...driver.events].sort((a,b)=>n(b.roundNumber)-n(a.roundNumber)).slice(0,5) : [];
    if (!events.length) {
      target.innerHTML = '<div class="pilot-dashboard-empty">Todavía no hay carreras registradas.</div>';
      return;
    }

    target.innerHTML = events.map(event => {
      const race = getMainRace(event);
      const qual = getQual(event);
      const poleBonus = race && n(race.gridPosition) === 1 ? 1 : 0;
      const eventPoints = n(event.pointsEarned) + poleBonus;
      const gain = race ? n(race.positionChange) : 0;
      const gainText = gain > 0 ? `+${gain}` : String(gain);
      const gainClass = gain > 0 ? 'positive' : gain < 0 ? 'negative' : '';
      const fastest = (event.races || []).some(item => item.isFastestLap);
      const sprint = (event.races || []).find(item => /sprint/i.test(String(item.sessionName || '')));
      const status = race?.isFinished === false ? (race.status || 'No finalizó') : (race?.status || 'Finalizada');
      return `<article class="pilot-race-card">
        <div class="pilot-race-head">
          <div><span>R${esc(event.roundNumber ?? '—')} · ${esc(fmtDate(event.eventDate))}</span><h3>${esc(event.eventName || event.trackName || 'Gran Premio')}</h3></div>
          <strong class="pilot-race-position">${race ? fmtPos(race.position) : '—'}</strong>
        </div>
        <div class="pilot-race-stats">
          <div><span>QUALY</span><strong>${qual ? fmtPos(qual.position) : '—'}</strong></div>
          <div><span>PARRILLA</span><strong>${race ? fmtPos(race.gridPosition) : '—'}</strong></div>
          <div><span>POSICIONES</span><strong class="${gainClass}">${race ? gainText : '—'}</strong></div>
          <div><span>PUNTOS</span><strong>${fmtPoints(eventPoints)}</strong></div>
        </div>
        <div class="pilot-race-tags">
          <span>${esc(status)}</span>
          ${poleBonus ? '<span class="accent">POLE +1</span>' : ''}
          ${fastest ? '<span class="purple">VUELTA RÁPIDA</span>' : ''}
          ${sprint ? `<span>SPRINT ${fmtPos(sprint.position)}</span>` : ''}
        </div>
      </article>`;
    }).join('');
  }

  function contractRemaining(contract) {
    if (!contract) return 'Sin contrato activo';
    if (contract.contract_end_label) return contract.contract_end_label;
    const halves = contract.half_seasons_remaining;
    if (halves == null) return 'No informado';
    const value = Number(halves);
    if (value === 0) return 'Finaliza ahora';
    if (value === 1) return '½ temporada';
    if (value % 2 === 0) return `${value/2} temporada${value/2 === 1 ? '' : 's'}`;
    return `${Math.floor(value/2)}½ temporadas`;
  }

  function renderContract(contract, teamName) {
    const target = document.getElementById('pilotContractCard');
    if (!contract) {
      target.innerHTML = '<div class="pilot-dashboard-empty">No hay un contrato activo registrado para este piloto.</div>';
      return;
    }
    const remaining = contractRemaining(contract);
    const start = contract.contract_start_label || (contract.start_date ? new Intl.DateTimeFormat('es-ES').format(new Date(`${contract.start_date}T12:00:00`)) : '—');
    const end = contract.contract_end_label || (contract.end_date ? new Intl.DateTimeFormat('es-ES').format(new Date(`${contract.end_date}T12:00:00`)) : '—');
    target.innerHTML = `
      <div class="pilot-contract-team"><span>ESCUDERÍA</span><strong>${esc(teamName || '—')}</strong></div>
      <div class="pilot-contract-main"><span>CONTRATO RESTANTE</span><strong>${esc(remaining)}</strong></div>
      <div class="pilot-contract-grid">
        <div><span>VALOR DEL PILOTO</span><strong>${fmtMoney(contract.driver_value_m)}</strong></div>
        <div><span>CLÁUSULA</span><strong>${fmtMoney(contract.buyout_clause_m)}</strong></div>
        <div><span>INICIO</span><strong>${esc(start)}</strong></div>
        <div><span>FIN</span><strong>${esc(end)}</strong></div>
      </div>
      ${contract.is_team_principal_contract ? '<div class="pilot-contract-note">Contrato asociado a Team Principal.</div>' : ''}`;
  }

  function driverTeamMembers(standings, teamName) {
    const list = standings?.seasonStatistics?.driverStandings || [];
    return list.filter(driver => normalize(driver.teamName) === normalize(teamName));
  }

  function driverMax(teamDrivers, selector) {
    return teamDrivers.reduce((max,driver)=>Math.max(max,n(selector(driver))),0);
  }

  function driverBestStreak(teamDrivers, predicate) {
    let best = 0;
    teamDrivers.forEach(driver => {
      const events = [...(driver.events || [])].sort((a,b)=>n(a.roundNumber)-n(b.roundNumber));
      let streak = 0;
      events.forEach(event => {
        if (predicate(event,driver)) { streak++; best=Math.max(best,streak); } else streak=0;
      });
    });
    return best;
  }

  function teamRounds(teamDrivers) {
    const rounds = new Map();
    teamDrivers.forEach(driver => {
      (driver.events || []).forEach(event => {
        const round = n(event.roundNumber);
        if (!round) return;
        if (!rounds.has(round)) rounds.set(round,[]);
        rounds.get(round).push({driver,event,race:getMainRace(event),qual:getQual(event)});
      });
    });
    return [...rounds.entries()].sort((a,b)=>a[0]-b[0]);
  }

  function longestRoundStreak(rounds, predicate) {
    let best=0, streak=0, prev=null;
    rounds.forEach(([round,rows]) => {
      if (prev != null && round !== prev+1) streak=0;
      if (predicate(rows)) { streak++; best=Math.max(best,streak); } else streak=0;
      prev=round;
    });
    return best;
  }

  function objectiveEvaluation(objective, dbCompleted, standings, teamName, teamStanding) {
    if (dbCompleted) return {status:'completed',label:'CUMPLIDO',progress:'Marcado como cumplido en Race Control'};
    const text = String(objective || '');
    const lower = text.toLowerCase();
    const teamDrivers = driverTeamMembers(standings, teamName);
    const rounds = teamRounds(teamDrivers);
    const seasonCompleted = !!standings?.seasonStatistics?.status?.isCompleted;
    const teamPos = n(teamStanding?.adjustedPosition || teamStanding?.position);

    const milestone = (current,target,label='') => ({status:current>=target?'completed':'pending',label:current>=target?'CUMPLIDO':'PENDIENTE',progress:`${label}${current}/${target}`});
    const seasonTarget = (condition,progress) => ({status:seasonCompleted && condition?'completed':'pending',label:seasonCompleted && condition?'CUMPLIDO':'PENDIENTE',progress});

    let m;
    if (/campeonato de constructores/.test(lower) && /ganar/.test(lower)) return seasonTarget(teamPos===1, teamPos?`Posición actual: P${teamPos}`:'Sin clasificación');
    if ((m=lower.match(/entre los (\d+) primeros.*constructores/))) return seasonTarget(teamPos>0 && teamPos<=n(m[1]), teamPos?`Posición actual: P${teamPos} · objetivo Top ${m[1]}`:'Sin clasificación');
    if ((m=lower.match(/entre los (\d+) primeros del campeonato de constructores/))) return seasonTarget(teamPos>0 && teamPos<=n(m[1]), teamPos?`Posición actual: P${teamPos} · objetivo Top ${m[1]}`:'Sin clasificación');

    if ((m=lower.match(/sumar más de (\d+) puntos en un mismo gp/))) {
      const best = rounds.reduce((max,[,rows])=>Math.max(max,rows.reduce((sum,row)=>sum+n(row.event.pointsEarned)+(row.race&&n(row.race.gridPosition)===1?1:0),0)),0);
      return milestone(best,n(m[1])+1,'Mejor GP: ');
    }
    if ((m=lower.match(/sumar (?:más de|al menos) (\d+) puntos en la temporada.*piloto/))) {
      const target = /más de/.test(lower) ? n(m[1])+1 : n(m[1]);
      const best = driverMax(teamDrivers,d=>n(d.points)+driverPoleBonus(d));
      return milestone(best,target,'Mejor piloto: ');
    }
    if ((m=lower.match(/(?:ganar|lograr al menos) (\d+) (?:carreras|victorias).*piloto/))) return milestone(driverMax(teamDrivers,d=>d.positions?.wins),n(m[1]),'Mejor piloto: ');
    if ((m=lower.match(/(?:conseguir|al menos) (?:al menos )?(\d+) podios.*piloto/))) return milestone(driverMax(teamDrivers,d=>d.positions?.podiums),n(m[1]),'Mejor piloto: ');
    if ((m=lower.match(/(?:conseguir|al menos) (?:al menos )?(\d+) poles.*piloto/))) return milestone(driverMax(teamDrivers,d=>d.positions?.polePositions),n(m[1]),'Mejor piloto: ');
    if (/al menos una pole/.test(lower)) return milestone(driverMax(teamDrivers,d=>d.positions?.polePositions),1,'Poles: ');
    if ((m=lower.match(/top (\d+) en al menos (\d+) carreras.*piloto/))) {
      const best = teamDrivers.reduce((mx,d)=>Math.max(mx,(d.events||[]).filter(e=>{const r=getMainRace(e);return r&&n(r.position)<=n(m[1]);}).length),0);
      return milestone(best,n(m[2]),'Mejor piloto: ');
    }
    if (/al menos 1 top 8/.test(lower)) {
      const best = teamDrivers.reduce((mx,d)=>Math.max(mx,(d.events||[]).filter(e=>{const r=getMainRace(e);return r&&n(r.position)<=8;}).length),0);
      return milestone(best,1,'Top 8: ');
    }
    if ((m=lower.match(/racha de (\d+) carreras seguidas en puntos.*piloto/))) return milestone(driverBestStreak(teamDrivers,e=>n(e.pointsEarned)>0),n(m[1]),'Mejor racha: ');
    if ((m=lower.match(/puntos en (\d+) carreras consecutivas.*piloto/))) return milestone(driverBestStreak(teamDrivers,e=>n(e.pointsEarned)>0),n(m[1]),'Mejor racha: ');
    if ((m=lower.match(/ganar (\d+) carreras consecutivas.*piloto/))) return milestone(driverBestStreak(teamDrivers,e=>n(getMainRace(e)?.position)===1),n(m[1]),'Mejor racha: ');
    if ((m=lower.match(/conseguir (\d+) vueltas rápidas/))) return milestone(driverMax(teamDrivers,d=>d.positions?.fastestLaps),n(m[1]),'Mejor piloto: ');
    if (/vuelta rápida$/.test(lower)) return milestone(driverMax(teamDrivers,d=>d.positions?.fastestLaps),1,'Vueltas rápidas: ');

    if ((m=lower.match(/(?:doble top|ambos pilotos en el top|ambos coches en top)\s*(\d+).*?(\d+) (?:carreras|veces)?/))) {
      const count = rounds.filter(([,rows])=>rows.filter(row=>row.race&&n(row.race.position)<=n(m[1])).length>=2).length;
      return milestone(count,n(m[2]),`GP con doble Top ${m[1]}: `);
    }
    if ((m=lower.match(/al menos (\d+) doble top (\d+)/))) {
      const count=rounds.filter(([,rows])=>rows.filter(row=>row.race&&n(row.race.position)<=n(m[2])).length>=2).length;
      return milestone(count,n(m[1]),`Dobles Top ${m[2]}: `);
    }
    if ((m=lower.match(/puntos con ambos coches en (\d+) carreras/))) {
      const count=rounds.filter(([,rows])=>rows.filter(row=>n(row.event.pointsEarned)>0).length>=2).length;
      return milestone(count,n(m[1]),'Dobles puntuaciones: ');
    }
    if ((m=lower.match(/puntos en al menos (\d+) carreras.*equipo/))) {
      const count=rounds.filter(([,rows])=>rows.some(row=>n(row.event.pointsEarned)>0)).length;
      return milestone(count,n(m[1]),'GP puntuando: ');
    }
    if (/hacer dos doble podio/.test(lower)) {
      const count=rounds.filter(([,rows])=>rows.filter(row=>row.race&&n(row.race.position)<=3).length>=2).length;
      return milestone(count,2,'Dobles podios: ');
    }
    if (/lograr un podio con ambos pilotos/.test(lower)) {
      const completedDrivers=teamDrivers.filter(d=>(d.positions?.podiums||0)>0).length;
      return milestone(completedDrivers,2,'Pilotos con podio: ');
    }
    if ((m=lower.match(/primera fila al menos (\d+) veces/))) {
      const count=rounds.reduce((sum,[,rows])=>sum+rows.filter(row=>row.qual&&n(row.qual.position)<=2).length,0);
      return milestone(count,n(m[1]),'Primeras filas: ');
    }
    if ((m=lower.match(/clasificar (?:en el )?top (\d+) en al menos (\d+) gp/))) {
      const count=rounds.filter(([,rows])=>rows.some(row=>row.qual&&n(row.qual.position)<=n(m[1]))).length;
      return milestone(count,n(m[2]),`GP con Top ${m[1]} en qualy: `);
    }
    if ((m=lower.match(/clasificar al menos (\d+) veces en el top (\d+)/))) {
      const count=rounds.reduce((sum,[,rows])=>sum+rows.filter(row=>row.qual&&n(row.qual.position)<=n(m[2])).length,0);
      return milestone(count,n(m[1]),`Qualys Top ${m[2]}: `);
    }
    if (/clasificar en el top 10 una vez/.test(lower)) {
      const count=rounds.reduce((sum,[,rows])=>sum+rows.filter(row=>row.qual&&n(row.qual.position)<=10).length,0);
      return milestone(count,1,'Top 10 en qualy: ');
    }
    if ((m=lower.match(/top 3 en clasificación en (\d+) carreras/))) {
      const count=rounds.filter(([,rows])=>rows.some(row=>row.qual&&n(row.qual.position)<=3)).length;
      return milestone(count,n(m[1]),'GP con Top 3 en qualy: ');
    }
    if ((m=lower.match(/top 5 en clasificación en (\d+) gp/))) {
      const count=rounds.filter(([,rows])=>rows.some(row=>row.qual&&n(row.qual.position)<=5)).length;
      return milestone(count,n(m[1]),'GP con Top 5 en qualy: ');
    }
    if ((m=lower.match(/mejorar posición de salida en al menos (\d+) carreras/))) {
      const best=teamDrivers.reduce((mx,d)=>Math.max(mx,(d.events||[]).filter(e=>n(getMainRace(e)?.positionChange)>0).length),0);
      return milestone(best,n(m[1]),'Mejor piloto: ');
    }
    if ((m=lower.match(/racha de (\d+) carreras consecutivas sumando puntos/))) {
      const streak=longestRoundStreak(rounds,rows=>rows.some(row=>n(row.event.pointsEarned)>0));
      return milestone(streak,n(m[1]),'Racha del equipo: ');
    }

    const completedRounds=n(standings?.season?.completedRounds || standings?.seasonStatistics?.status?.completedRounds || rounds.length);
    if (/todas las carreras con al menos un coche en puntos/.test(lower)) {
      const ok=rounds.filter(([,rows])=>rows.some(row=>n(row.event.pointsEarned)>0)).length;
      return seasonTarget(seasonCompleted && ok===completedRounds,`Cumplidas hasta ahora: ${ok}/${completedRounds}`);
    }
    if (/todas las carreras con al menos un coche en meta/.test(lower)) {
      const ok=rounds.filter(([,rows])=>rows.some(row=>row.race?.isFinished !== false)).length;
      return seasonTarget(seasonCompleted && ok===completedRounds,`Cumplidas hasta ahora: ${ok}/${completedRounds}`);
    }
    if (/sin doble abandono/.test(lower)) {
      const doubleDnfs=rounds.filter(([,rows])=>rows.filter(row=>row.race?.isFinished===false).length>=2).length;
      return seasonTarget(seasonCompleted && doubleDnfs===0,`Dobles abandonos: ${doubleDnfs}`);
    }
    if ((m=lower.match(/no abandonar más de (\d+) carreras/))) {
      const dnfs=teamDrivers.reduce((sum,d)=>sum+n(d.penalties?.dnfCount),0);
      return seasonTarget(seasonCompleted && dnfs<=n(m[1]),`Abandonos: ${dnfs}/${m[1]} máx.`);
    }
    if ((m=lower.match(/terminar (?:al menos )?(\d+)% de las carreras con ambos coches/))) {
      const both=rounds.filter(([,rows])=>rows.filter(row=>row.race?.isFinished!==false).length>=2).length;
      const pct=completedRounds?Math.round((both/completedRounds)*100):0;
      return seasonTarget(seasonCompleted && pct>=n(m[1]),`Actual: ${pct}% · objetivo ${m[1]}%`);
    }
    if ((m=lower.match(/finalizar al menos (\d+)% de las carreras dentro del top 10/))) {
      const races=teamDrivers.flatMap(d=>d.events||[]).map(getMainRace).filter(Boolean);
      const top=races.filter(r=>n(r.position)<=10).length;
      const pct=races.length?Math.round(top/races.length*100):0;
      return seasonTarget(seasonCompleted && pct>=n(m[1]),`Actual: ${pct}% · objetivo ${m[1]}%`);
    }

    return {status:'pending',label:'PENDIENTE',progress:'Seguimiento manual / cierre de temporada'};
  }

  function renderObjectives(objectives, standings, teamName, teamStanding) {
    const target = document.getElementById('pilotObjectives');
    if (!Array.isArray(objectives) || !objectives.length) {
      target.innerHTML = '<div class="pilot-dashboard-empty">No hay objetivos activos para esta escudería y división.</div>';
      return;
    }
    target.innerHTML = objectives.map(item => {
      const evaluation = objectiveEvaluation(item.objective,item.is_completed,standings,teamName,teamStanding);
      return `<article class="pilot-objective-card ${evaluation.status}">
        <div class="pilot-objective-top"><div><span>#${esc(item.sponsor_number)} · ${esc(item.name)}</span><strong>${fmtMoney(item.effective_reward_m)}</strong></div><span class="pilot-objective-state">${esc(evaluation.label)}</span></div>
        <p>${esc(item.objective)}</p>
        <small>${esc(evaluation.progress)}</small>
      </article>`;
    }).join('');
  }

  async function load() {
    if (loading || pilotView.classList.contains('is-hidden')) return;
    loading = true;
    buildShell();
    const state = document.getElementById('pilotDataState');
    if (state) { state.textContent='CARGANDO'; state.classList.remove('ok'); }

    try {
      const { data:{session} } = await client.auth.getSession();
      if (!session) return;
      const profileRes = await client.from('profiles').select('driver_id,drivers:driver_id(id,nickname,race_number)').eq('id',session.user.id).maybeSingle();
      if (profileRes.error) throw profileRes.error;
      const driver = profileRes.data?.drivers;
      if (!driver?.id) throw new Error('No hay piloto vinculado.');
      if (loadedForDriver === driver.id && document.getElementById('pilotChampionshipCards')?.dataset.loaded === '1') return;

      const privateRes = await client.rpc('pilot_dashboard_private',{p_season_number:config.currentSeason});
      if (privateRes.error) throw privateRes.error;
      const privateData = privateRes.data || {};
      const division = String(privateData.division || '').toLowerCase();
      const teamName = privateData.team_name || document.getElementById('pilotTeam')?.textContent || '';
      if (!['academy','hyperdrive'].includes(division)) throw new Error('El piloto no tiene una división activa.');
      const otherDivision = division === 'academy' ? 'hyperdrive' : 'academy';

      const [currentStandings, otherStandings, officialsData] = await Promise.all([
        fetchJSON(`/data/${division}-standings.json`),
        fetchJSON(`/data/${otherDivision}-standings.json`),
        fetchJSON('/data/official-drivers.json')
      ]);
      if (!currentStandings) throw new Error(`No se pudo cargar la clasificación ${division}.`);

      const officials = officialDriverSet(officialsData,division);
      const championship = renderChampionships(driver.nickname,teamName,division,currentStandings,otherStandings,officials);
      renderSeasonStats(championship.driver);
      renderRecentRaces(championship.driver,division);
      renderContract(privateData.contract,teamName);
      renderObjectives(privateData.objectives,currentStandings,teamName,championship.team);

      const cards=document.getElementById('pilotChampionshipCards');
      if (cards) cards.dataset.loaded='1';
      loadedForDriver=driver.id;
      if (state) { state.textContent='ACTUALIZADO'; state.classList.add('ok'); }
    } catch (error) {
      console.error('Pilot dashboard error:',error);
      if (state) { state.textContent='REVISAR'; state.classList.remove('ok'); }
      ['pilotChampionshipCards','pilotSeasonStats','pilotRecentRaces','pilotContractCard','pilotObjectives'].forEach(id=>{
        const el=document.getElementById(id);
        if (el && /Cargando|pilot-standing-card/.test(el.textContent || '')) el.innerHTML='<div class="pilot-dashboard-empty">No se pudieron cargar estos datos.</div>';
      });
    } finally {
      loading=false;
    }
  }

  buildShell();
  const observer=new MutationObserver(()=>{ if (!pilotView.classList.contains('is-hidden')) window.setTimeout(load,30); });
  observer.observe(pilotView,{attributes:true,attributeFilter:['class']});
  if (!pilotView.classList.contains('is-hidden')) load();
})();