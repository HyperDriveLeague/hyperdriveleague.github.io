(() => {
  const config = window.HYPERDRIVE_CONFIG;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const LIVE_ROOM = 'hyperdrive-live-v1';
  const DATA_BASE = 'https://hyperdriveleague.github.io/data/';
  const POINTS = [25,20,16,13,11,10,9,8,7,6,5,4,3,2,1];
  const $ = id => document.getElementById(id);

  let latestState = null;
  let lastStateAt = 0;
  let activeChamp = 'drivers';
  let roster = [];
  let aliases = [];
  let teams = [];
  let drivers = [];
  let aliasToDriver = new Map();
  let driverById = new Map();
  let standingsBase = null;
  let standingsLive = null;
  let standingsLoadToken = 0;

  function norm(value) {
    return String(value || '').trim().toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  }

  function formatMs(ms) {
    const n = Number(ms || 0);
    if (!Number.isFinite(n) || n <= 0) return '—';
    const minutes = Math.floor(n / 60000);
    const seconds = (n % 60000) / 1000;
    return minutes ? minutes + ':' + seconds.toFixed(3).padStart(6, '0') : seconds.toFixed(3);
  }

  function formatGap(ms) {
    const n = Number(ms || 0);
    if (!Number.isFinite(n) || n <= 0) return '—';
    return '+' + (n / 1000).toFixed(3);
  }

  function formatClock(seconds) {
    const n = Math.max(0, Number(seconds || 0));
    if (!n) return '—';
    const m = Math.floor(n / 60);
    const s = Math.floor(n % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function setError(message) {
    $('authError').textContent = message;
    $('authError').classList.remove('is-hidden');
    $('casterContent').classList.add('is-hidden');
  }

  function selectedDivision() {
    return $('divisionSelect').value;
  }

  function selectedRound() {
    return Number($('roundSelect').value || 1);
  }

  function divisionLabel(v) {
    return v === 'academy' ? 'Academy' : 'HyperDrive';
  }

  function sessionLabel(type) {
    const labels = {
      5:'Q1',6:'Q2',7:'Q3',8:'Short Qualy',9:'One-Shot Qualy',
      10:'Sprint Shootout 1',11:'Sprint Shootout 2',12:'Sprint Shootout 3',
      13:'Short Sprint Shootout',14:'One-Shot Sprint Shootout',
      15:'Carrera',16:'Carrera 2',17:'Carrera 3'
    };
    return labels[Number(type)] || 'Sesión';
  }

  function currentRoster(driverId, division, round) {
    return roster
      .filter(r => r.driver_id === driverId && r.division === division && Number(r.start_round) <= round && (r.end_round == null || Number(r.end_round) >= round))
      .sort((a,b) => Number(b.start_round) - Number(a.start_round))[0] || null;
  }

  function resolveDriverId(name) {
    const key = norm(name);
    if (!key) return null;
    if (aliasToDriver.has(key)) return aliasToDriver.get(key);

    const candidates = [];
    for (const [alias, id] of aliasToDriver.entries()) {
      if (alias.length >= 5 && (key.endsWith(alias) || alias.endsWith(key))) candidates.push(id);
    }
    return [...new Set(candidates)].length === 1 ? candidates[0] : null;
  }

  function driverInfo(driverId) {
    return driverById.get(driverId) || null;
  }

  async function fetchOptional(path) {
    try {
      const res = await fetch(DATA_BASE + path, { cache: 'no-store' });
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function blankStandings() {
    return {
      drivers: { academy: new Map(), hyperdrive: new Map() },
      constructors: { academy: new Map(), hyperdrive: new Map() }
    };
  }

  function ensureDriverEntry(store, driverId, division, round) {
    if (!driverId || store.drivers[division].has(driverId)) return;
    const d = driverInfo(driverId);
    const rr = currentRoster(driverId, division, round);
    store.drivers[division].set(driverId, {
      id: driverId,
      name: d?.nickname || 'Piloto',
      raceNumber: d?.race_number ?? null,
      team: rr?.teams?.name || 'SIN EQUIPO',
      points: 0
    });
  }

  function ensureTeamEntry(map, teamName) {
    const name = String(teamName || '').trim();
    if (!name) return null;
    const key = norm(name);
    if (!map.has(key)) map.set(key, { key, name, points: 0 });
    return map.get(key);
  }

  function seedStandings(store, round) {
    roster.forEach(r => {
      if (r.roster_status !== 'official' || Number(r.start_round) > round) return;
      ensureDriverEntry(store, r.driver_id, r.division, round);
    });
    teams.forEach(t => {
      ensureTeamEntry(store.constructors.academy, t.name);
      ensureTeamEntry(store.constructors.hyperdrive, t.name);
    });
  }

  function processResultFile(store, division, round, type, data) {
    const rows = data?.session?.drivers;
    if (!Array.isArray(rows)) return;

    rows.forEach(row => {
      const name = String(row.driverName || '').trim();
      const driverId = resolveDriverId(name);
      const rr = driverId ? currentRoster(driverId, division, round) : null;
      const teamName = String(row?.team?.name || rr?.teams?.name || '').trim();
      const basePoints = Number(row.driverPoints || 0);
      const poleBonus = type === 'race' && Number(row.gridPosition) === 1 ? 1 : 0;
      const points = (Number.isFinite(basePoints) ? basePoints : 0) + poleBonus;

      if (driverId && rr?.roster_status === 'official') {
        ensureDriverEntry(store, driverId, division, round);
        const entry = store.drivers[division].get(driverId);
        entry.points += points;
        if (teamName) entry.team = teamName;
      }

      const team = ensureTeamEntry(store.constructors[division], teamName);
      if (team) team.points += points;
    });
  }

  async function buildBaseStandings() {
    const token = ++standingsLoadToken;
    const liveDivision = selectedDivision();
    const round = selectedRound();
    const store = blankStandings();
    seedStandings(store, round);

    const requests = [];
    for (const division of ['academy','hyperdrive']) {
      for (let r = 1; r <= round; r += 1) {
        const includeMain = r < round || division !== liveDivision;
        if (includeMain) {
          requests.push(
            fetchOptional(division + '_r' + r + '.json').then(data => ({ division, round:r, type:'race', data }))
          );
        }
        requests.push(
          fetchOptional(division + '_r' + r + '_sprint.json').then(data => ({ division, round:r, type:'sprint', data }))
        );
      }
    }

    const loaded = await Promise.all(requests);
    if (token !== standingsLoadToken) return;

    loaded
      .filter(x => x.data?.session?.drivers)
      .sort((a,b) => a.round - b.round || (a.type === 'sprint' ? -1 : 1))
      .forEach(x => processResultFile(store, x.division, x.round, x.type, x.data));

    standingsBase = store;
    rebuildLiveStandings();
  }

  function cloneStandings(base) {
    const out = blankStandings();
    for (const division of ['academy','hyperdrive']) {
      base.drivers[division].forEach((v,k) => out.drivers[division].set(k, { ...v }));
      base.constructors[division].forEach((v,k) => out.constructors[division].set(k, { ...v }));
    }
    return out;
  }

  function livePointsForPosition(position) {
    const p = Number(position);
    return p >= 1 && p <= POINTS.length ? POINTS[p - 1] : 0;
  }

  function sameTelemetryName(a, b) {
    return norm(a) === norm(b) || (resolveDriverId(a) && resolveDriverId(a) === resolveDriverId(b));
  }

  function rebuildLiveStandings() {
    if (!standingsBase) return;
    standingsLive = cloneStandings(standingsBase);

    if (latestState?.session?.mode === 'race') {
      const division = selectedDivision();
      const round = selectedRound();
      const poleName = latestState.session.poleName;
      const fastestName = latestState.session.fastestLapName;

      (latestState.cars || []).forEach(car => {
        const driverId = resolveDriverId(car.name);
        if (!driverId) return;
        const rr = currentRoster(driverId, division, round);
        if (!rr) return;

        let points = livePointsForPosition(car.position);
        if (poleName && sameTelemetryName(car.name, poleName)) points += 1;
        if (fastestName && sameTelemetryName(car.name, fastestName)) points += 1;

        if (rr.roster_status === 'official') {
          ensureDriverEntry(standingsLive, driverId, division, round);
          const d = standingsLive.drivers[division].get(driverId);
          d.points += points;
          d.team = rr.teams?.name || d.team;
        }

        const t = ensureTeamEntry(standingsLive.constructors[division], rr.teams?.name);
        if (t) t.points += points;
      });
    }

    renderChampionship();
  }

  function sortedDrivers(store, division) {
    return [...store.drivers[division].values()].sort((a,b) => b.points - a.points || a.name.localeCompare(b.name, 'es'));
  }

  function sortedConstructors(store, division) {
    return [...store.constructors[division].values()].sort((a,b) => b.points - a.points || a.name.localeCompare(b.name, 'es'));
  }

  function superconstructors(store) {
    const map = new Map();
    for (const division of ['academy','hyperdrive']) {
      store.constructors[division].forEach(team => {
        const key = norm(team.name);
        if (!map.has(key)) map.set(key, { key, name: team.name, academy:0, hyperdrive:0, points:0 });
        const item = map.get(key);
        item[division] += team.points;
        item.points += team.points;
      });
    }
    return [...map.values()].sort((a,b) => b.points - a.points || a.name.localeCompare(b.name, 'es'));
  }

  function basePositionMap(type) {
    if (!standingsBase) return new Map();
    let list = [];
    if (type === 'drivers') list = sortedDrivers(standingsBase, selectedDivision()).map(x => ({ key:x.id }));
    if (type === 'constructors') list = sortedConstructors(standingsBase, selectedDivision()).map(x => ({ key:x.key }));
    if (type === 'superconstructors') list = superconstructors(standingsBase).map(x => ({ key:x.key }));
    return new Map(list.map((x,i) => [x.key, i + 1]));
  }

  function renderChampionship() {
    const target = $('championshipLiveList');
    if (!target || !standingsLive) return;
    target.innerHTML = '';

    let list;
    if (activeChamp === 'drivers') list = sortedDrivers(standingsLive, selectedDivision()).map(x => ({ ...x, key:x.id, sub:x.team }));
    else if (activeChamp === 'constructors') list = sortedConstructors(standingsLive, selectedDivision()).map(x => ({ ...x, sub:divisionLabel(selectedDivision()) }));
    else list = superconstructors(standingsLive).map(x => ({ ...x, sub:'HD ' + x.hyperdrive + ' · AC ' + x.academy }));

    const basePos = basePositionMap(activeChamp);

    list.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'champ-row';

      const pos = document.createElement('div');
      pos.className = 'champ-pos';
      pos.textContent = 'P' + (index + 1);

      const name = document.createElement('div');
      name.className = 'champ-name';
      const strong = document.createElement('strong');
      strong.textContent = activeChamp === 'drivers'
        ? '#' + (item.raceNumber ?? '--') + ' ' + item.name
        : item.name;
      const sub = document.createElement('span');
      sub.textContent = item.sub || '';
      name.append(strong, sub);

      const pts = document.createElement('div');
      pts.className = 'champ-points';
      pts.textContent = String(item.points);

      const old = basePos.get(item.key);
      const now = index + 1;
      const change = document.createElement('div');
      if (!old || old === now) {
        change.className = 'champ-change same';
        change.textContent = '—';
      } else if (now < old) {
        change.className = 'champ-change up';
        change.textContent = '▲' + (old - now);
      } else {
        change.className = 'champ-change down';
        change.textContent = '▼' + (now - old);
      }

      row.append(pos, name, pts, change);
      target.appendChild(row);
    });
  }

  function renderQualy(state) {
    const body = $('qualyTimingBody');
    body.innerHTML = '';
    const cars = (state.cars || []).slice().sort((a,b) => {
      if (a.bestLapMs && b.bestLapMs) return a.bestLapMs - b.bestLapMs;
      if (a.bestLapMs) return -1;
      if (b.bestLapMs) return 1;
      return a.index - b.index;
    });
    const pole = cars.find(c => c.bestLapMs > 0)?.bestLapMs || 0;

    cars.forEach((car, i) => {
      const tr = document.createElement('tr');

      const pos = document.createElement('td');
      pos.className = 'timing-pos';
      pos.textContent = car.bestLapMs ? 'P' + (i + 1) : '—';

      const driver = document.createElement('td');
      const cell = document.createElement('div');
      cell.className = 'driver-cell';
      const color = document.createElement('span');
      color.className = 'driver-color';
      color.style.background = car.color || '#ffd500';
      const copy = document.createElement('div');
      copy.className = 'driver-copy';
      const strong = document.createElement('strong');
      strong.textContent = '#' + (car.raceNumber || '--') + ' ' + car.name;
      const meta = document.createElement('span');
      meta.textContent = car.invalid ? 'VUELTA INVÁLIDA' : 'Vuelta ' + (car.currentLap || '—');
      if (car.invalid) meta.className = 'invalid-lap';
      copy.append(strong, meta);
      cell.append(color, copy);
      driver.appendChild(cell);

      const best = document.createElement('td');
      best.textContent = formatMs(car.bestLapMs);

      const gap = document.createElement('td');
      gap.textContent = car.bestLapMs && pole ? (car.bestLapMs === pole ? 'POLE' : formatGap(car.bestLapMs - pole)) : '—';

      const s1 = document.createElement('td'); s1.textContent = formatMs(car.bestS1Ms);
      const s2 = document.createElement('td'); s2.textContent = formatMs(car.bestS2Ms);
      const s3 = document.createElement('td'); s3.textContent = formatMs(car.bestS3Ms);

      const microTd = document.createElement('td');
      const strip = document.createElement('div');
      strip.className = 'micro-strip';
      (car.micro || Array(20).fill('none')).forEach(status => {
        const m = document.createElement('span');
        m.className = 'micro-cell ' + status;
        strip.appendChild(m);
      });
      microTd.appendChild(strip);

      tr.append(pos, driver, best, gap, s1, s2, s3, microTd);
      body.appendChild(tr);
    });
  }

  function renderRace(state) {
    const body = $('raceTimingBody');
    body.innerHTML = '';
    const cars = (state.cars || []).slice().filter(c => c.position > 0).sort((a,b) => a.position - b.position);
    const maxLap = cars.reduce((m,c) => Math.max(m, Number(c.currentLap || 0)), 0);
    $('raceLapLabel').textContent = 'VUELTA ' + (maxLap || '—') + (state.session.totalLaps ? ' / ' + state.session.totalLaps : '');

    cars.forEach(car => {
      const tr = document.createElement('tr');
      const pos = document.createElement('td'); pos.className = 'timing-pos'; pos.textContent = 'P' + car.position;

      const driver = document.createElement('td');
      const cell = document.createElement('div'); cell.className = 'driver-cell';
      const color = document.createElement('span'); color.className = 'driver-color'; color.style.background = car.color || '#ffd500';
      const copy = document.createElement('div'); copy.className = 'driver-copy';
      const strong = document.createElement('strong'); strong.textContent = '#' + (car.raceNumber || '--') + ' ' + car.name;
      if (state.session.fastestLapName && sameTelemetryName(car.name, state.session.fastestLapName)) {
        const badge = document.createElement('span'); badge.className = 'fastest-badge'; badge.textContent = 'VR'; strong.appendChild(badge);
      }
      const meta = document.createElement('span'); meta.textContent = car.speed ? car.speed + ' km/h' : 'Vuelta ' + car.currentLap;
      copy.append(strong, meta); cell.append(color, copy); driver.appendChild(cell);

      const gap = document.createElement('td'); gap.textContent = car.position === 1 ? 'LEADER' : formatGap(car.gapLeaderMs);
      const tyre = document.createElement('td'); tyre.textContent = (car.tyre || '?') + (car.tyreAge ? ' · ' + car.tyreAge + 'L' : '');
      const last = document.createElement('td'); last.textContent = formatMs(car.lastLapMs);
      const best = document.createElement('td'); best.textContent = formatMs(car.bestLapMs);
      const pit = document.createElement('td'); pit.textContent = car.pitStatus ? (car.pitStatus === 2 ? 'PIT' : 'IN') : String(car.pitStops || 0);
      const pen = document.createElement('td'); pen.textContent = car.penalties ? '+' + car.penalties + 's' : '—';
      tr.append(pos, driver, gap, tyre, last, best, pit, pen);
      body.appendChild(tr);
    });
  }

  function mapTransform(state) {
    const trace = state.trackTrace || [];
    const cars = state.cars || [];
    const pts = trace.concat(cars.filter(c => Number.isFinite(c.x) && Number.isFinite(c.z)).map(c => ({x:c.x,z:c.z})));
    if (!pts.length) return null;
    const xs = pts.map(p => Number(p.x)).filter(Number.isFinite);
    const zs = pts.map(p => Number(p.z)).filter(Number.isFinite);
    if (!xs.length || !zs.length) return null;
    let minX=Math.min(...xs), maxX=Math.max(...xs), minZ=Math.min(...zs), maxZ=Math.max(...zs);
    if (maxX-minX < 1) { minX-=1; maxX+=1; }
    if (maxZ-minZ < 1) { minZ-=1; maxZ+=1; }
    const pad=42, w=800-pad*2, h=520-pad*2;
    const scale=Math.min(w/(maxX-minX),h/(maxZ-minZ));
    const usedW=(maxX-minX)*scale, usedH=(maxZ-minZ)*scale;
    const ox=(800-usedW)/2, oy=(520-usedH)/2;
    return {
      x:v=>ox+(v-minX)*scale,
      y:v=>520-(oy+(v-minZ)*scale)
    };
  }

  function renderMap(state) {
    const traceLayer = $('trackLayer');
    const carsLayer = $('carsLayer');
    traceLayer.innerHTML = '';
    carsLayer.innerHTML = '';

    const trace = (state.trackTrace || []).slice().sort((a,b) => a.d-b.d);
    $('mapCoverage').textContent = Math.round(Math.min(1, trace.length / 180) * 100) + '% trazado';
    const tf = mapTransform(state);
    if (!tf) return;

    if (trace.length >= 2) {
      const d = trace.map((p,i) => (i ? 'L' : 'M') + tf.x(Number(p.x)).toFixed(1) + ',' + tf.y(Number(p.z)).toFixed(1)).join(' ');
      for (const cls of ['track-outline','track-line']) {
        const path = document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('d', d);
        path.setAttribute('class', cls);
        traceLayer.appendChild(path);
      }
    }

    (state.cars || []).forEach(car => {
      if (!Number.isFinite(Number(car.x)) || !Number.isFinite(Number(car.z))) return;
      const g=document.createElementNS('http://www.w3.org/2000/svg','g');
      g.setAttribute('class','map-car');
      const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');
      circle.setAttribute('cx',tf.x(Number(car.x))); circle.setAttribute('cy',tf.y(Number(car.z))); circle.setAttribute('r','13');
      circle.setAttribute('fill',car.color||'#ffd500');
      const text=document.createElementNS('http://www.w3.org/2000/svg','text');
      text.setAttribute('x',tf.x(Number(car.x))); text.setAttribute('y',tf.y(Number(car.z))+0.5);
      text.textContent=car.initials||String(car.name||'').slice(0,2).toUpperCase();
      const title=document.createElementNS('http://www.w3.org/2000/svg','title');
      title.textContent='P'+(car.position||'—')+' · '+car.name;
      g.append(circle,text,title); carsLayer.appendChild(g);
    });
  }

  function renderState(state) {
    latestState = state;
    lastStateAt = Date.now();

    $('liveDot').classList.remove('offline');
    $('liveDot').classList.add('online');
    $('liveStatus').textContent = 'F1 26 UDP conectado';
    $('modeLabel').textContent = state.session.mode === 'qualifying' ? 'QUALY' : state.session.mode === 'race' ? 'CARRERA' : 'AUTO';
    $('sessionLabel').textContent = sessionLabel(state.session.sessionType);
    $('liveTitle').textContent = state.session.mode === 'qualifying' ? 'Qualifying Live' : state.session.mode === 'race' ? 'Carrera Live' : 'Sesión en directo';
    $('liveContext').textContent = 'TEMPORADA ' + config.currentSeason + ' · R' + selectedRound() + ' · ' + divisionLabel(selectedDivision());
    $('poleDriver').textContent = state.session.poleName || '—';
    $('fastestDriver').textContent = state.session.fastestLapName ? state.session.fastestLapName + (state.session.fastestLapMs ? ' · ' + formatMs(state.session.fastestLapMs) : '') : '—';
    $('timeLeft').textContent = formatClock(state.session.timeLeft);

    $('waitingPanel').classList.toggle('is-hidden', state.session.mode === 'qualifying' || state.session.mode === 'race');
    $('qualyPanel').classList.toggle('is-hidden', state.session.mode !== 'qualifying');
    $('racePanel').classList.toggle('is-hidden', state.session.mode !== 'race');
    $('championshipPanel').classList.toggle('is-hidden', state.session.mode !== 'race');

    if (state.session.mode === 'qualifying') renderQualy(state);
    if (state.session.mode === 'race') {
      renderRace(state);
      rebuildLiveStandings();
    }
    renderMap(state);
  }

  async function loadLeagueData() {
    const [rosterRes,aliasesRes,teamsRes,driversRes] = await Promise.all([
      client.from('season_roster').select('id,driver_id,team_id,division,roster_status,start_round,end_round,is_active,teams:team_id(id,name)').eq('season_number', config.currentSeason),
      client.from('driver_result_aliases').select('driver_id,alias,normalized_alias'),
      client.from('teams').select('id,name,is_active'),
      client.from('drivers').select('id,nickname,race_number,is_active')
    ]);
    const bad=[rosterRes,aliasesRes,teamsRes,driversRes].find(r=>r.error);
    if (bad) throw bad.error;

    roster=rosterRes.data||[];
    aliases=aliasesRes.data||[];
    teams=teamsRes.data||[];
    drivers=driversRes.data||[];
    driverById=new Map(drivers.map(d=>[d.id,d]));
    aliasToDriver=new Map();

    drivers.forEach(d=>aliasToDriver.set(norm(d.nickname),d.id));
    aliases.forEach(a=>{
      const k=a.normalized_alias||norm(a.alias);
      if(k) aliasToDriver.set(k,a.driver_id);
    });
  }

  async function inferDefaultRound() {
    const { data } = await client.from('wagering_events')
      .select('round_number,division,status,opens_at,race_at')
      .eq('season_number',config.currentSeason)
      .order('race_at');
    const list=data||[];
    const active=list.find(x=>x.status==='open')||list.find(x=>x.status==='upcoming')||list[0];
    return active ? Number(active.round_number) : 1;
  }

  function setupRoundSelect(defaultRound) {
    const select=$('roundSelect'); select.innerHTML='';
    for(let i=1;i<=12;i+=1){
      const o=document.createElement('option');o.value=String(i);o.textContent='Ronda '+i;if(i===defaultRound)o.selected=true;select.appendChild(o);
    }
  }

  async function refreshContext() {
    $('liveContext').textContent='TEMPORADA '+config.currentSeason+' · R'+selectedRound()+' · '+divisionLabel(selectedDivision());
    standingsBase=null; standingsLive=null;
    $('championshipLiveList').innerHTML='<div class="wager-empty">Calculando campeonato base…</div>';
    await buildBaseStandings();
  }

  function subscribeRealtime() {
    const channel = client.channel(LIVE_ROOM);
    channel.on('broadcast',{event:'state'},message=>{
      const state=message?.payload;
      if(state?.version===1) renderState(state);
    });
    channel.subscribe(status=>{
      if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
        $('liveStatus').textContent='Error de conexión Realtime';
      }
    });
  }

  async function init() {
    const { data:{ session } } = await client.auth.getSession();
    if(!session) return window.location.replace('index.html');

    const { data:rolesData, error:rolesError } = await client.from('user_roles').select('role').eq('user_id',session.user.id);
    if(rolesError) return setError('No se pudieron comprobar tus permisos.');
    const roles=(rolesData||[]).map(x=>x.role);
    if(!roles.includes('staff')&&!roles.includes('admin')) return setError('Este módulo está reservado a Staff y Administración.');

    try {
      const defaultRound=await inferDefaultRound();
      setupRoundSelect(defaultRound);
      await loadLeagueData();
      await refreshContext();
      subscribeRealtime();

      $('authError').classList.add('is-hidden');
      $('casterContent').classList.remove('is-hidden');
    } catch(error) {
      console.error(error);
      setError(error.message||'No se pudo iniciar Caster Live.');
    }
  }

  document.querySelectorAll('.champ-tab').forEach(button=>{
    button.addEventListener('click',()=>{
      activeChamp=button.dataset.champ;
      document.querySelectorAll('.champ-tab').forEach(x=>x.classList.toggle('active',x===button));
      renderChampionship();
    });
  });

  $('divisionSelect').addEventListener('change',refreshContext);
  $('roundSelect').addEventListener('change',refreshContext);

  $('logoutButton').addEventListener('click',async()=>{
    await client.auth.signOut();
    window.location.replace('index.html');
  });

  setInterval(()=>{
    if(!lastStateAt||Date.now()-lastStateAt>2500){
      $('liveDot').classList.remove('online');
      $('liveDot').classList.add('offline');
      $('liveStatus').textContent=lastStateAt?'Sin datos UDP recientes':'Esperando F1 26 UDP…';
    }
  },500);

  init();
})();