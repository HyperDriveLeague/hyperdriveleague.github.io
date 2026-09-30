(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const pilotView = document.getElementById('pilotView');
  if (!config || !pilotView || !window.supabase) return;

  const TOTAL_ROUNDS = 12;
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

  const classificationPosition = d => {
    const c = Number(d?.classificationPosition);
    if (Number.isFinite(c) && c > 0) return c;
    const p = Number(d?.position);
    return Number.isFinite(p) && p > 0 ? p : null;
  };

  const isFinished = d => String(d?.status ?? '').toLowerCase() === 'finished';
  const sessionPoints = (session, d) => num(d?.driverPoints) + (session.type === 'race' && num(d?.gridPosition) === 1 ? 1 : 0);

  function teamIdentity(team) {
    const teamName = String(team?.name ?? '').trim();
    const uniqueId = String(team?.uniqueId ?? '').trim();
    return {
      teamName,
      teamKey: uniqueId ? `id:${key(uniqueId)}` : (teamName ? `name:${key(teamName)}` : ''),
      teamInfo: team || null
    };
  }

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
      if (r.status === 404) return null;
      return r.ok ? await r.json() : null;
    } catch (_) {
      return null;
    }
  }

  async function loadSessions(division) {
    const jobs = [];
    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      for (const type of ['sprint','race']) {
        const suffix = type === 'sprint' ? '_sprint' : '';
        jobs.push((async () => {
          const data = await getJSON(`/data/${division}_r${round}${suffix}.json`);
          return data?.session && Array.isArray(data.session.drivers)
            ? { division, round, type, data }
            : null;
        })());
      }
    }

    return (await Promise.all(jobs))
      .filter(Boolean)
      .sort((a,b) => a.round - b.round || (a.type === b.type ? 0 : (a.type === 'sprint' ? -1 : 1)));
  }

  function officialMap(data, division) {
    const map = new Map();
    const list = Array.isArray(data?.[division]) ? data[division] : [];

    list.forEach(x => {
      const driverName = String(typeof x === 'string' ? x : (x?.driverName ?? x?.name ?? '')).trim();
      if (!driverName) return;
      map.set(key(driverName), {
        driverName,
        teamName: String(x?.teamName ?? x?.team ?? '').trim()
      });
    });

    return map;
  }

  function buildModel(division, sessions, officialData) {
    const official = officialMap(officialData, division);
    const drivers = new Map();
    const teams = new Map();
    const rounds = new Map();

    official.forEach((o,k) => {
      drivers.set(k, {
        driverName: o.driverName,
        teamName: o.teamName,
        points: 0,
        wins: 0,
        podiums: 0,
        poles: 0,
        fastestLaps: 0,
        races: 0,
        finished: 0,
        racePositions: [],
        gridPositions: [],
        events: new Map(),
        lastRound: 0,
        lastSessionOrder: 0
      });
    });

    sessions.forEach(session => {
      const main = session.type === 'race';
      const event = session.data?.event || {};
      const fastestKey = key(session.data?.session?.fastestLap?.driverName);
      const eventRound = rounds.get(session.round) || { round:session.round, teamPoints:new Map(), main:null, sprint:null };
      eventRound[session.type] = session;
      rounds.set(session.round, eventRound);

      (session.data?.session?.drivers || []).forEach(raw => {
        const name = String(raw?.driverName ?? '').trim();
        if (!name) return;

        const dk = key(name);
        const awarded = sessionPoints(session, raw);
        const team = teamIdentity(raw?.team);

        // Exactamente como campeonato.html: Constructores solo nace de equipos
        // presentes en archivos de carrera, y usa uniqueId de RLT cuando existe.
        if (team.teamName && team.teamKey) {
          if (!teams.has(team.teamKey)) {
            teams.set(team.teamKey, {
              teamKey: team.teamKey,
              teamName: team.teamName,
              points: 0,
              teamInfo: team.teamInfo
            });
          }

          const standingTeam = teams.get(team.teamKey);
          standingTeam.points += awarded;
          standingTeam.teamName = team.teamName;
          if (team.teamInfo) standingTeam.teamInfo = team.teamInfo;
          eventRound.teamPoints.set(team.teamKey, (eventRound.teamPoints.get(team.teamKey) || 0) + awarded);
        }

        // Igual que campeonato.html: reservas suman a Constructores,
        // pero no al Mundial de Pilotos.
        if (!official.has(dk)) return;

        const d = drivers.get(dk);
        d.points += awarded;

        const sessionOrder = main ? 2 : 1;
        if (
          team.teamName &&
          (
            session.round > d.lastRound ||
            (session.round === d.lastRound && sessionOrder >= d.lastSessionOrder)
          )
        ) {
          d.teamName = team.teamName;
          d.lastRound = session.round;
          d.lastSessionOrder = sessionOrder;
        }

        let ev = d.events.get(session.round);
        if (!ev) {
          ev = {
            roundNumber: session.round,
            eventName: event?.track?.trackName || `Ronda ${session.round}`,
            eventDate: event.eventDateTime || event.eventDate || null,
            pointsEarned: 0,
            race: null,
            sprint: null
          };
          d.events.set(session.round, ev);
        }

        ev.pointsEarned += awarded;
        ev[session.type] = {
          raw,
          position: classificationPosition(raw),
          gridPosition: num(raw.gridPosition) || null,
          positionChange: Number.isFinite(Number(raw.positionChange)) ? Number(raw.positionChange) : null,
          status: raw.status || '',
          isFinished: isFinished(raw),
          points: awarded,
          isFastestLap: fastestKey === dk
        };

        if (main) {
          d.races += 1;
          if (isFinished(raw)) d.finished += 1;
          const p = classificationPosition(raw);
          if (p) d.racePositions.push(p);
          if (num(raw.gridPosition) > 0) d.gridPositions.push(num(raw.gridPosition));
          if (p === 1) d.wins += 1;
          if (p && p <= 3) d.podiums += 1;
          if (num(raw.gridPosition) === 1) d.poles += 1;
          if (fastestKey === dk) d.fastestLaps += 1;
        }
      });
    });

    const driverStandings = [...drivers.values()]
      .sort((a,b) => b.points - a.points || a.driverName.localeCompare(b.driverName,'es'))
      .map((d,i) => ({
        ...d,
        position: i + 1,
        events: [...d.events.values()].sort((a,b) => a.roundNumber - b.roundNumber)
      }));

    const teamStandings = [...teams.values()]
      .sort((a,b) => b.points - a.points || a.teamName.localeCompare(b.teamName,'es'))
      .map((t,i) => ({ ...t, position:i + 1 }));

    return {
      division,
      sessions,
      official,
      driverStandings,
      teamStandings,
      rounds,
      completedRounds: [...rounds.values()].filter(r => r.main).length,
      isCompleted: [...rounds.values()].filter(r => r.main).length >= TOTAL_ROUNDS
    };
  }

  function superStandings(hyperdrive, academy) {
    const map = new Map();

    [['hyperdrive',hyperdrive],['academy',academy]].forEach(([division,model]) => {
      model.teamStandings.forEach(t => {
        // Igual que campeonato.html: mismo uniqueId entre divisiones = misma escudería.
        const uniqueId = String(t?.teamInfo?.uniqueId ?? '').trim();
        const k = uniqueId ? `id:${key(uniqueId)}` : `name:${key(t.teamName)}`;

        if (!map.has(k)) {
          map.set(k, {
            teamKey: k,
            teamName: t.teamName,
            hyperdrive: 0,
            academy: 0,
            total: 0,
            teamInfo: t.teamInfo || null
          });
        }

        const row = map.get(k);
        row[division] += t.points;
        row.total = row.hyperdrive + row.academy;
        if (t.teamInfo) row.teamInfo = t.teamInfo;
      });
    });

    return [...map.values()]
      .sort((a,b) => b.total - a.total || a.teamName.localeCompare(b.teamName,'es'))
      .map((t,i) => ({ ...t, position:i + 1 }));
  }

  function renderChampionships(driverName, teamName, division, current, other) {
    const d = current.driverStandings.find(x => key(x.driverName) === key(driverName));
    const t = current.teamStandings.find(x => key(x.teamName) === key(teamName));
    const supers = superStandings(
      division === 'hyperdrive' ? current : other,
      division === 'academy' ? current : other
    );
    const s = supers.find(x => key(x.teamName) === key(teamName));
    const label = division === 'academy' ? 'ACADEMY' : 'HYPERDRIVE';

    document.getElementById('pilotChampionshipCards').innerHTML = `
      <article class="pilot-standing-card"><span>MUNDIAL DE PILOTOS</span><strong>${d?pos(d.position):'—'}</strong><small>${d?`${pts(d.points)} pts · ${esc(d.driverName)}`:'Sin datos'}</small></article>
      <article class="pilot-standing-card"><span>CONSTRUCTORES · ${label}</span><strong>${t?pos(t.position):'—'}</strong><small>${t?`${pts(t.points)} pts · ${esc(t.teamName)}`:'Sin datos'}</small></article>
      <article class="pilot-standing-card featured"><span>SUPERCONSTRUCTORES</span><strong>${s?pos(s.position):'—'}</strong><small>${s?`${pts(s.total)} pts · ${pts(s.hyperdrive)} HD + ${pts(s.academy)} AC`:'Sin datos'}</small></article>`;

    return { driver:d, team:t };
  }

  function average(list) {
    return list.length ? list.reduce((a,b) => a + b, 0) / list.length : null;
  }

  function renderSeason(d) {
    const target = document.getElementById('pilotSeasonStats');
    if (!d) {
      target.innerHTML = '<div class="pilot-dashboard-empty">No hay estadísticas de temporada.</div>';
      return;
    }

    const avgRace = average(d.racePositions);
    const avgGrid = average(d.gridPositions);
    const rows = [
      ['PUNTOS',pts(d.points)],
      ['VICTORIAS',d.wins],
      ['PODIOS',d.podiums],
      ['POLES',d.poles],
      ['V. RÁPIDAS',d.fastestLaps],
      ['MEDIA CARRERA',avgRace ? avgRace.toLocaleString('es-ES',{maximumFractionDigits:2}) : '—'],
      ['MEDIA PARRILLA',avgGrid ? avgGrid.toLocaleString('es-ES',{maximumFractionDigits:2}) : '—'],
      ['FINALIZADAS',`${d.finished}/${d.races}`],
      ['CARRERAS',d.races]
    ];

    target.innerHTML = rows.map(([l,v]) => `<article class="pilot-stat-card"><span>${esc(l)}</span><strong>${esc(v)}</strong></article>`).join('');
  }

  function penaltySeconds(d) {
    const p = d?.penalties || {};
    if (p.totalPenaltyTimeSeconds != null) return num(p.totalPenaltyTimeSeconds);
    return num(p.inGamePenaltySeconds) + num(p.stewardPenaltySeconds);
  }

  function ratingText(r) {
    if (r?.rating == null) return '—';
    const rank = num(r?.position) > 0 ? ` · P${num(r.position)}` : '';
    return `${r.rating}/10${rank}`;
  }

  function raceDetail(label,value) {
    return `<div><span>${esc(label)}</span><strong>${esc(value ?? '—')}</strong></div>`;
  }

  function renderRecent(d, division) {
    const target = document.getElementById('pilotRecentRaces');
    document.getElementById('pilotResultsDivision').textContent = division === 'academy' ? 'ACADEMY' : 'HYPERDRIVE';
    const events = d?.events ? [...d.events].sort((a,b) => b.roundNumber - a.roundNumber).slice(0,5) : [];

    if (!events.length) {
      target.innerHTML = '<div class="pilot-dashboard-empty">Todavía no hay carreras registradas.</div>';
      return;
    }

    target.innerHTML = events.map(e => {
      const race = e.race;
      const sprint = e.sprint;
      const raw = race?.raw;
      const gain = race?.positionChange;
      const stats = [
        ['PARRILLA',race?.gridPosition ? pos(race.gridPosition) : '—'],
        ['POSICIONES',gain == null ? '—' : gain > 0 ? `+${gain}` : String(gain)],
        ['PUNTOS',pts(e.pointsEarned)],
        ['V. RÁPIDA',raw?.fastestLapTime || '—'],
        ['VEL. MÁX.',raw?.raceDetails?.maxSpeed ? `${raw.raceDetails.maxSpeed} km/h` : '—'],
        ['RITMO RLT',ratingText(raw?.ratings?.pace)],
        ['CONSISTENCIA',ratingText(raw?.ratings?.consistency)],
        ['VUELTAS',raw?.lapsCompleted ?? '—'],
        ['PENALIZACIÓN',penaltySeconds(raw) ? `${penaltySeconds(raw)} s` : '0 s']
      ];

      const status = race?.isFinished === false ? (race.status || 'No finalizó') : (race?.status || 'Finalizada');
      return `<article class="pilot-race-card">
        <div class="pilot-race-head"><div><span>R${esc(e.roundNumber)} · ${esc(dateShort(e.eventDate))}</span><h3>${esc(e.eventName)}</h3></div><strong class="pilot-race-position">${race?.position?pos(race.position):'—'}</strong></div>
        <div class="pilot-race-stats pilot-race-stats-rich">${stats.map(([l,v]) => raceDetail(l,v)).join('')}</div>
        <div class="pilot-race-tags"><span>${esc(status)}</span>${race?.gridPosition===1?'<span class="accent">POLE +1</span>':''}${race?.isFastestLap?'<span class="purple">VUELTA RÁPIDA</span>':''}${sprint?`<span>SPRINT ${sprint.position?pos(sprint.position):'—'}</span>`:''}</div>
      </article>`;
    }).join('');
  }

  function remaining(c) {
    if (!c) return 'Sin contrato activo';
    if (c.contract_end_label) return c.contract_end_label;
    if (c.half_seasons_remaining == null) return 'No informado';
    const h = num(c.half_seasons_remaining);
    if (h === 0) return 'Finaliza ahora';
    if (h === 1) return '½ temporada';
    if (h % 2 === 0) return `${h/2} temporada${h===2?'':'s'}`;
    return `${Math.floor(h/2)}½ temporadas`;
  }

  function renderContract(c, teamName) {
    const t = document.getElementById('pilotContractCard');
    if (!c) {
      t.innerHTML = '<div class="pilot-dashboard-empty">No hay contrato activo registrado.</div>';
      return;
    }

    const f = v => v ? new Intl.DateTimeFormat('es-ES').format(new Date(`${v}T12:00:00`)) : '—';
    const start = c.contract_start_label || f(c.start_date);
    const end = c.contract_end_label || f(c.end_date);

    t.innerHTML = `<div class="pilot-contract-team"><span>ESCUDERÍA</span><strong>${esc(teamName||'—')}</strong></div><div class="pilot-contract-main"><span>CONTRATO RESTANTE</span><strong>${esc(remaining(c))}</strong></div><div class="pilot-contract-grid"><div><span>VALOR DEL PILOTO</span><strong>${money(c.driver_value_m)}</strong></div><div><span>CLÁUSULA</span><strong>${money(c.buyout_clause_m)}</strong></div><div><span>INICIO</span><strong>${esc(start)}</strong></div><div><span>FIN</span><strong>${esc(end)}</strong></div></div>${c.is_team_principal_contract?'<div class="pilot-contract-note">Contrato asociado a Team Principal.</div>':''}`;
  }

  function maxDriver(model, teamName, fn) {
    return model.driverStandings
      .filter(d => key(d.teamName) === key(teamName))
      .reduce((m,d) => Math.max(m,num(fn(d))),0);
  }

  function teamRoundPoints(model, teamName) {
    const standing = model.teamStandings.find(t => key(t.teamName) === key(teamName));
    const tk = standing?.teamKey || `name:${key(teamName)}`;
    return [...model.rounds.values()].map(r => ({ round:r.round, points:num(r.teamPoints.get(tk)) }));
  }

  function bestStreak(values,pred) {
    let best=0,s=0;
    values.forEach(v => {
      s = pred(v) ? s + 1 : 0;
      best = Math.max(best,s);
    });
    return best;
  }

  function evalObjective(text, dbDone, model, teamName, teamStanding) {
    if (dbDone) return {status:'completed',label:'CUMPLIDO',progress:'Marcado como cumplido en Race Control'};

    const q = String(text||'').toLowerCase();
    const teamPos = num(teamStanding?.position);
    const ended = model.isCompleted;
    const rounds = teamRoundPoints(model,teamName);
    let m;

    const progress = (cur,target,label='') => ({status:cur>=target?'completed':'pending',label:cur>=target?'CUMPLIDO':'PENDIENTE',progress:`${label}${cur}/${target}`});
    const final = (ok,p) => ({status:ended&&ok?'completed':'pending',label:ended&&ok?'CUMPLIDO':'PENDIENTE',progress:p});

    if (/ganar el campeonato de constructores/.test(q)) return final(teamPos===1,teamPos?`Posición actual: P${teamPos}`:'Sin clasificación');
    if ((m=q.match(/entre los (\d+) primeros.*constructores/))) return final(teamPos>0&&teamPos<=num(m[1]),teamPos?`Posición actual: P${teamPos} · objetivo Top ${m[1]}`:'Sin clasificación');
    if (/campeonato de pilotos/.test(q)) {
      const best = Math.min(...model.driverStandings.filter(d=>key(d.teamName)===key(teamName)).map(d=>d.position));
      return final(best===1,Number.isFinite(best)?`Mejor piloto del equipo: P${best}`:'Sin clasificación');
    }
    if ((m=q.match(/sumar más de (\d+) puntos en un mismo gp.*equipo/))) {
      const best=Math.max(0,...rounds.map(r=>r.points)),threshold=num(m[1]);
      return {status:best>threshold?'completed':'pending',label:best>threshold?'CUMPLIDO':'PENDIENTE',progress:`Mejor GP: ${pts(best)} pts · objetivo >${threshold}`};
    }
    if ((m=q.match(/(?:más de|al menos) (\d+) puntos en la temporada.*piloto/))) {
      const best=maxDriver(model,teamName,d=>d.points),threshold=num(m[1]);
      if (/más de/.test(q)) return {status:best>threshold?'completed':'pending',label:best>threshold?'CUMPLIDO':'PENDIENTE',progress:`Mejor piloto: ${pts(best)} pts · objetivo >${threshold}`};
      return progress(best,threshold,'Mejor piloto: ');
    }
    if ((m=q.match(/(?:conseguir|lograr).*?(\d+) victorias.*piloto/))) return progress(maxDriver(model,teamName,d=>d.wins),num(m[1]),'Mejor piloto: ');
    if ((m=q.match(/(?:conseguir|al menos|lograr).*?(\d+) podios.*piloto/))) return progress(maxDriver(model,teamName,d=>d.podiums),num(m[1]),'Mejor piloto: ');
    if ((m=q.match(/(?:conseguir|al menos).*?(\d+) poles.*piloto/))) return progress(maxDriver(model,teamName,d=>d.poles),num(m[1]),'Mejor piloto: ');
    if ((m=q.match(/racha de (\d+) carreras seguidas en puntos.*piloto/))) {
      const best=model.driverStandings.filter(d=>key(d.teamName)===key(teamName)).reduce((mx,d)=>Math.max(mx,bestStreak(d.events,e=>num(e.pointsEarned)>0)),0);
      return progress(best,num(m[1]),'Mejor racha: ');
    }
    if ((m=q.match(/racha de (\d+) carreras consecutivas sumando puntos/))) return progress(bestStreak(rounds,r=>r.points>0),num(m[1]),'Racha del equipo: ');
    if ((m=q.match(/top (\d+) en al menos (\d+) carreras/))) {
      const best=model.driverStandings.filter(d=>key(d.teamName)===key(teamName)).reduce((mx,d)=>Math.max(mx,d.events.filter(e=>e.race?.position&&e.race.position<=num(m[1])).length),0);
      return progress(best,num(m[2]),'Mejor piloto: ');
    }

    return {status:'pending',label:'PENDIENTE',progress:'Seguimiento manual / cierre de temporada'};
  }

  function renderObjectives(items, model, teamName, teamStanding) {
    const t = document.getElementById('pilotObjectives');
    if (!Array.isArray(items) || !items.length) {
      t.innerHTML = '<div class="pilot-dashboard-empty">No hay objetivos activos para esta división.</div>';
      return;
    }

    t.innerHTML = items.map(x => {
      const e = evalObjective(x.objective,x.is_completed,model,teamName,teamStanding);
      return `<article class="pilot-objective-card ${e.status}"><div class="pilot-objective-top"><div><span>#${esc(x.sponsor_number)} · ${esc(x.name)}</span><strong>${money(x.effective_reward_m)}</strong></div><span class="pilot-objective-state">${esc(e.label)}</span></div><p>${esc(x.objective)}</p><small>${esc(e.progress)}</small></article>`;
    }).join('');
  }

  async function load() {
    if (loading || pilotView.classList.contains('is-hidden')) return;
    loading = true;
    buildShell();

    const state = document.getElementById('pilotDataState');
    if (state) {
      state.textContent='CARGANDO';
      state.classList.remove('ok');
    }

    try {
      const {data:{session}} = await client.auth.getSession();
      if (!session) return;

      const pr = await client.from('profiles').select('driver_id,drivers:driver_id(id,nickname,race_number)').eq('id',session.user.id).maybeSingle();
      if (pr.error) throw pr.error;

      const d = pr.data?.drivers;
      if (!d?.id) throw new Error('No hay piloto vinculado.');
      if (loadedDriver === d.id && document.getElementById('pilotChampionshipCards')?.dataset.loaded === '1') return;

      const priv = await client.rpc('pilot_dashboard_private',{p_season_number:config.currentSeason});
      if (priv.error) throw priv.error;
      const pd = priv.data || {};
      const division = String(pd.division||'').toLowerCase();
      const teamName = pd.team_name || '';
      if (!['academy','hyperdrive'].includes(division)) throw new Error('Sin división activa.');

      const [officials,academySessions,hyperdriveSessions] = await Promise.all([
        getJSON('/data/official-drivers.json'),
        loadSessions('academy'),
        loadSessions('hyperdrive')
      ]);

      if (!officials) throw new Error('No se pudo cargar la lista de pilotos oficiales.');

      const academy = buildModel('academy',academySessions,officials);
      const hyperdrive = buildModel('hyperdrive',hyperdriveSessions,officials);
      const current = division === 'academy' ? academy : hyperdrive;
      const other = division === 'academy' ? hyperdrive : academy;
      const champ = renderChampionships(d.nickname,teamName,division,current,other);

      renderSeason(champ.driver);
      renderRecent(champ.driver,division);
      renderContract(pd.contract,teamName);
      renderObjectives(pd.objectives,current,teamName,champ.team);

      const cards = document.getElementById('pilotChampionshipCards');
      if (cards) cards.dataset.loaded='1';
      loadedDriver=d.id;
      if (state) {
        state.textContent='ACTUALIZADO';
        state.classList.add('ok');
      }
    } catch(error) {
      console.error('Pilot dashboard error:',error);
      if (state) {
        state.textContent='REVISAR';
        state.classList.remove('ok');
      }
      ['pilotChampionshipCards','pilotSeasonStats','pilotRecentRaces','pilotContractCard','pilotObjectives'].forEach(id => {
        const el=document.getElementById(id);
        if(el) el.innerHTML='<div class="pilot-dashboard-empty">No se pudieron cargar estos datos.</div>';
      });
    } finally {
      loading=false;
    }
  }

  const observer = new MutationObserver(() => {
    if (!pilotView.classList.contains('is-hidden')) window.setTimeout(load,30);
  });
  observer.observe(pilotView,{attributes:true,attributeFilter:['class']});
  if (!pilotView.classList.contains('is-hidden')) load();
})();