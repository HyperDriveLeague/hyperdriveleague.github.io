const WebSocket = require('ws');
global.WebSocket = WebSocket;

const { createClient } = require('@supabase/supabase-js');
const { F1TelemetryClient, constants } = require('@z0mt3c/f1-telemetry-client');

const { PACKETS } = constants;

const UDP_PORT = Number(process.env.UDP_PORT || 20777);
const LIVE_ROOM = process.env.LIVE_ROOM || 'hyperdrive-live-v1';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://knyxattsjimsjefydcad.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_hLAzZZF6kki1xZ0Kyx6lfA_97kzSAmf';
const PUBLISH_HZ = Math.max(1, Math.min(10, Number(process.env.PUBLISH_HZ || 10)));
const MICRO_COUNT = 20;
const TRACE_BINS = 180;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket }
});

const channel = supabase.channel(LIVE_ROOM, {
  config: { broadcast: { self: false, ack: false } }
});

let realtimeReady = false;
channel.subscribe(status => {
  realtimeReady = status === 'SUBSCRIBED';
  console.log('[Realtime]', status, 'room:', LIVE_ROOM);
});

const telemetry = new F1TelemetryClient({ port: UDP_PORT, bigintEnabled: false });

let sessionUID = null;
let session = blankSession();
let participants = Array(24).fill(null);
let numActiveCars = 0;
let lapData = Array(24).fill(null);
let motionData = Array(24).fill(null);
let carStatus = Array(24).fill(null);
let carTelemetry = Array(24).fill(null);
let history = Array.from({ length: 24 }, () => ({ bestLapMs: 0, bestS1Ms: 0, bestS2Ms: 0, bestS3Ms: 0 }));
let micros = Array.from({ length: 24 }, () => newMicroState());
let trackTrace = Array(TRACE_BINS).fill(null);
let lastQualifyingPole = null;
let lastPacketAt = 0;
let publishing = false;

function blankSession() {
  return {
    sessionType: 0,
    mode: 'unknown',
    trackId: -1,
    trackLength: 0,
    totalLaps: 0,
    timeLeft: 0,
    duration: 0,
    weather: 0,
    trackTemperature: null,
    airTemperature: null,
    sector2Start: 0,
    sector3Start: 0
  };
}

function newMicroState() {
  return {
    lapNum: null,
    lastDistance: null,
    lastTime: null,
    lastInvalid: false,
    nextSegment: 0,
    boundaryTime: 0,
    current: Array(MICRO_COUNT).fill(null),
    personalBest: Array(MICRO_COUNT).fill(Infinity)
  };
}

function resetSessionData(uid) {
  sessionUID = uid;
  session = blankSession();
  participants = Array(24).fill(null);
  numActiveCars = 0;
  lapData = Array(24).fill(null);
  motionData = Array(24).fill(null);
  carStatus = Array(24).fill(null);
  carTelemetry = Array(24).fill(null);
  history = Array.from({ length: 24 }, () => ({ bestLapMs: 0, bestS1Ms: 0, bestS2Ms: 0, bestS3Ms: 0 }));
  micros = Array.from({ length: 24 }, () => newMicroState());
  trackTrace = Array(TRACE_BINS).fill(null);
}

function touch(packet) {
  lastPacketAt = Date.now();
  const raw = packet?.m_header?.m_sessionUID;
  const uid = raw == null ? null : String(raw);
  if (uid && uid !== sessionUID) resetSessionData(uid);
}

function modeFromSessionType(type) {
  if (type >= 5 && type <= 14) return 'qualifying';
  if (type >= 15 && type <= 17) return 'race';
  return 'other';
}

function activeCount() {
  return numActiveCars > 0 ? Math.min(24, numActiveCars) : 24;
}

function hex2(n) {
  return Math.max(0, Math.min(255, Number(n || 0))).toString(16).padStart(2, '0');
}

function participantColor(p) {
  const c = Array.isArray(p?.m_liveryColours) ? p.m_liveryColours[0] : null;
  if (!c) return '#ffd500';
  const color = '#' + hex2(c.red) + hex2(c.green) + hex2(c.blue);
  return color === '#000000' ? '#ffd500' : color;
}

function initials(name) {
  const clean = String(name || '').replace(/[^a-zA-Z0-9]/g, '');
  if (!clean) return '--';
  if (clean.length <= 2) return clean.toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

function compoundLabel(id) {
  const map = { 7: 'I', 8: 'W', 16: 'S', 17: 'M', 18: 'H' };
  return map[Number(id)] || '?';
}

function finite(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function finalizeMicroLap(index, lastLapMs) {
  const m = micros[index];
  if (!m || m.lapNum == null) return;

  if (
    session.trackLength > 0 &&
    !m.lastInvalid &&
    Number.isFinite(lastLapMs) &&
    lastLapMs > 0 &&
    m.nextSegment === MICRO_COUNT - 1 &&
    Number.isFinite(m.boundaryTime)
  ) {
    const finalSplit = lastLapMs - m.boundaryTime;
    if (finalSplit > 0 && finalSplit < 60000) {
      m.current[MICRO_COUNT - 1] = finalSplit;
    }
  }

  if (!m.lastInvalid) {
    for (let i = 0; i < MICRO_COUNT; i += 1) {
      const value = m.current[i];
      if (Number.isFinite(value) && value > 0 && value < m.personalBest[i]) {
        m.personalBest[i] = value;
      }
    }
  }
}

function startMicroLap(index, lapNum, distance, timeMs) {
  const m = micros[index];
  m.lapNum = lapNum;
  m.lastDistance = distance;
  m.lastTime = timeMs;
  m.lastInvalid = false;
  m.current = Array(MICRO_COUNT).fill(null);

  const segmentLength = session.trackLength > 0 ? session.trackLength / MICRO_COUNT : 0;
  if (segmentLength > 0 && distance > segmentLength) {
    m.nextSegment = Math.min(MICRO_COUNT - 1, Math.floor(distance / segmentLength));
    m.boundaryTime = null;
  } else {
    m.nextSegment = 0;
    m.boundaryTime = 0;
  }
}

function processMicro(index, lap) {
  if (!lap || session.trackLength <= 0) return;

  const lapNum = finite(lap.m_currentLapNum, 0);
  const rawDistance = finite(lap.m_lapDistance, 0);
  const distance = Math.max(0, Math.min(session.trackLength, rawDistance));
  const timeMs = finite(lap.m_currentLapTimeInMS, 0);
  const invalid = Number(lap.m_currentLapInvalid) === 1;
  const m = micros[index];

  if (m.lapNum == null) {
    startMicroLap(index, lapNum, distance, timeMs);
    m.lastInvalid = invalid;
    return;
  }

  if (lapNum !== m.lapNum) {
    finalizeMicroLap(index, finite(lap.m_lastLapTimeInMS, 0));
    startMicroLap(index, lapNum, distance, timeMs);
    m.lastInvalid = invalid;
    return;
  }

  if (
    m.lastDistance == null ||
    m.lastTime == null ||
    distance < m.lastDistance ||
    timeMs < m.lastTime
  ) {
    m.lastDistance = distance;
    m.lastTime = timeMs;
    m.lastInvalid = invalid;
    return;
  }

  const segmentLength = session.trackLength / MICRO_COUNT;
  while (m.nextSegment < MICRO_COUNT - 1) {
    const threshold = segmentLength * (m.nextSegment + 1);
    if (threshold > distance) break;

    const distanceDelta = distance - m.lastDistance;
    const ratio = distanceDelta > 0
      ? Math.max(0, Math.min(1, (threshold - m.lastDistance) / distanceDelta))
      : 1;
    const crossingTime = m.lastTime + (timeMs - m.lastTime) * ratio;

    if (Number.isFinite(m.boundaryTime)) {
      const split = crossingTime - m.boundaryTime;
      if (split > 0 && split < 60000) m.current[m.nextSegment] = split;
    }

    m.boundaryTime = crossingTime;
    m.nextSegment += 1;
  }

  m.lastDistance = distance;
  m.lastTime = timeMs;
  m.lastInvalid = invalid;
}

function currentSessionBestMicros() {
  const best = Array(MICRO_COUNT).fill(Infinity);
  for (const m of micros) {
    for (let i = 0; i < MICRO_COUNT; i += 1) {
      if (Number.isFinite(m.personalBest[i]) && m.personalBest[i] < best[i]) best[i] = m.personalBest[i];
      const current = m.current[i];
      if (!m.lastInvalid && Number.isFinite(current) && current > 0 && current < best[i]) best[i] = current;
    }
  }
  return best;
}

function microStatuses(index, sessionBest) {
  const m = micros[index];
  if (!m) return Array(MICRO_COUNT).fill('none');

  return m.current.map((value, i) => {
    if (!Number.isFinite(value) || value <= 0) return 'none';
    if (m.lastInvalid) return 'invalid';
    const sessionValue = sessionBest[i];
    if (Number.isFinite(sessionValue) && Math.abs(value - sessionValue) < 0.5) return 'purple';
    const personal = m.personalBest[i];
    if (!Number.isFinite(personal) || value < personal) return 'green';
    return 'yellow';
  });
}

function bestFromHistoryPacket(packet) {
  const idx = Number(packet?.m_carIdx);
  if (!Number.isInteger(idx) || idx < 0 || idx >= 24) return;
  const laps = Array.isArray(packet.m_lapHistoryData) ? packet.m_lapHistoryData : [];

  function lapValue(lapNum, field) {
    const n = Number(lapNum);
    if (!n || n < 1 || n > laps.length) return 0;
    return finite(laps[n - 1]?.[field], 0);
  }

  history[idx] = {
    bestLapMs: lapValue(packet.m_bestLapTimeLapNum, 'm_lapTimeInMS'),
    bestS1Ms: lapValue(packet.m_bestSector1LapNum, 'm_sector1TimeInMS'),
    bestS2Ms: lapValue(packet.m_bestSector2LapNum, 'm_sector2TimeInMS'),
    bestS3Ms: lapValue(packet.m_bestSector3LapNum, 'm_sector3TimeInMS')
  };
}

function buildTrackTrace() {
  const points = [];
  for (let i = 0; i < trackTrace.length; i += 1) {
    const p = trackTrace[i];
    if (p) points.push({ d: i / (TRACE_BINS - 1), x: p.x, z: p.z });
  }
  return points;
}

function buildState() {
  const count = activeCount();
  const sessionBestMicros = currentSessionBestMicros();
  const cars = [];

  for (let i = 0; i < count; i += 1) {
    const p = participants[i];
    const lap = lapData[i];
    if (!p || !lap || !String(p.m_name || '').trim()) continue;

    const hist = history[i] || {};
    const stat = carStatus[i] || {};
    const telem = carTelemetry[i] || {};
    const motion = motionData[i] || {};

    cars.push({
      index: i,
      name: String(p.m_name || ('CAR ' + (i + 1))),
      initials: initials(p.m_name),
      raceNumber: finite(p.m_raceNumber, 0),
      teamId: finite(p.m_teamId, -1),
      color: participantColor(p),
      position: finite(lap.m_carPosition, 0),
      currentLap: finite(lap.m_currentLapNum, 0),
      currentLapMs: finite(lap.m_currentLapTimeInMS, 0),
      lastLapMs: finite(lap.m_lastLapTimeInMS, 0),
      bestLapMs: finite(hist.bestLapMs, 0),
      bestS1Ms: finite(hist.bestS1Ms, 0),
      bestS2Ms: finite(hist.bestS2Ms, 0),
      bestS3Ms: finite(hist.bestS3Ms, 0),
      sector1Ms: finite(lap.m_sector1TimeInMS, 0),
      sector2Ms: finite(lap.m_sector2TimeInMS, 0),
      gapLeaderMs: finite(lap.m_deltaToRaceLeaderInMS, 0),
      gapFrontMs: finite(lap.m_deltaToCarInFrontInMS, 0),
      lapDistance: finite(lap.m_lapDistance, 0),
      pitStatus: finite(lap.m_pitStatus, 0),
      pitStops: finite(lap.m_numPitStops, 0),
      penalties: finite(lap.m_penalties, 0),
      invalid: Number(lap.m_currentLapInvalid) === 1,
      resultStatus: finite(lap.m_resultStatus, 0),
      tyre: compoundLabel(stat.m_visualTyreCompound),
      tyreAge: finite(stat.m_tyresAgeLaps, 0),
      speed: finite(telem.m_speed, 0),
      drs: finite(telem.m_drs, 0),
      x: finite(motion.m_worldPositionX, 0),
      z: finite(motion.m_worldPositionZ, 0),
      micro: microStatuses(i, sessionBestMicros)
    });
  }

  const rankedByLap = cars
    .filter(c => c.bestLapMs > 0)
    .slice()
    .sort((a, b) => a.bestLapMs - b.bestLapMs);

  if (session.mode === 'qualifying' && rankedByLap.length) {
    lastQualifyingPole = rankedByLap[0].name;
  }

  const fastest = rankedByLap.length ? rankedByLap[0] : null;

  return {
    version: 1,
    emittedAt: Date.now(),
    source: 'F1 26 UDP',
    ephemeral: true,
    session: {
      ...session,
      uid: sessionUID,
      connected: Date.now() - lastPacketAt < 2500,
      poleName: lastQualifyingPole,
      fastestLapName: fastest?.name || null,
      fastestLapMs: fastest?.bestLapMs || 0
    },
    cars,
    trackTrace: buildTrackTrace()
  };
}

telemetry.on(PACKETS.session, packet => {
  touch(packet);
  session = {
    sessionType: finite(packet.m_sessionType, 0),
    mode: modeFromSessionType(finite(packet.m_sessionType, 0)),
    trackId: finite(packet.m_trackId, -1),
    trackLength: finite(packet.m_trackLength, 0),
    totalLaps: finite(packet.m_totalLaps, 0),
    timeLeft: finite(packet.m_sessionTimeLeft, 0),
    duration: finite(packet.m_sessionDuration, 0),
    weather: finite(packet.m_weather, 0),
    trackTemperature: finite(packet.m_trackTemperature, 0),
    airTemperature: finite(packet.m_airTemperature, 0),
    sector2Start: finite(packet.m_sector2LapDistanceStart, 0),
    sector3Start: finite(packet.m_sector3LapDistanceStart, 0)
  };
});

telemetry.on(PACKETS.participants, packet => {
  touch(packet);
  const list = Array.isArray(packet.m_participants) ? packet.m_participants : [];
  participants = list.slice(0, 24);
  numActiveCars = finite(packet.m_numActiveCars, 0);
});

telemetry.on(PACKETS.lapData, packet => {
  touch(packet);
  const list = Array.isArray(packet.m_lapData) ? packet.m_lapData : [];
  lapData = list.slice(0, 24);
  for (let i = 0; i < lapData.length; i += 1) processMicro(i, lapData[i]);
});

telemetry.on(PACKETS.motion, packet => {
  touch(packet);
  const list = Array.isArray(packet.m_carMotionData) ? packet.m_carMotionData : [];
  motionData = list.slice(0, 24);

  if (session.trackLength <= 0) return;

  for (let i = 0; i < motionData.length; i += 1) {
    const m = motionData[i];
    const lap = lapData[i];
    if (!m || !lap) continue;

    const d = finite(lap.m_lapDistance, -1);
    if (d < 0 || d > session.trackLength) continue;

    const ratio = Math.max(0, Math.min(1, d / session.trackLength));
    const bin = Math.max(0, Math.min(TRACE_BINS - 1, Math.round(ratio * (TRACE_BINS - 1))));
    const x = finite(m.m_worldPositionX, NaN);
    const z = finite(m.m_worldPositionZ, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;

    if (!trackTrace[bin]) {
      trackTrace[bin] = { x, z };
    } else {
      trackTrace[bin].x = trackTrace[bin].x * 0.9 + x * 0.1;
      trackTrace[bin].z = trackTrace[bin].z * 0.9 + z * 0.1;
    }
  }
});

telemetry.on(PACKETS.carStatus, packet => {
  touch(packet);
  const list = Array.isArray(packet.m_carStatusData) ? packet.m_carStatusData : [];
  carStatus = list.slice(0, 24);
});

telemetry.on(PACKETS.carTelemetry, packet => {
  touch(packet);
  const list = Array.isArray(packet.m_carTelemetryData) ? packet.m_carTelemetryData : [];
  carTelemetry = list.slice(0, 24);
});

telemetry.on(PACKETS.sessionHistory, packet => {
  touch(packet);
  bestFromHistoryPacket(packet);
});

telemetry.on('error', error => {
  console.error('[UDP parser]', error?.message || error);
});

setInterval(async () => {
  if (!realtimeReady || publishing || !lastPacketAt) return;
  publishing = true;
  try {
    await channel.send({
      type: 'broadcast',
      event: 'state',
      payload: buildState()
    });
  } catch (error) {
    console.error('[Realtime send]', error?.message || error);
  } finally {
    publishing = false;
  }
}, Math.round(1000 / PUBLISH_HZ));

process.on('SIGINT', async () => {
  console.log('\nCerrando HyperDrive Live Bridge…');
  try { telemetry.stop(); } catch {}
  try { await supabase.removeChannel(channel); } catch {}
  process.exit(0);
});

console.log('');
console.log('==============================================');
console.log(' HYPERDRIVE LIVE BRIDGE · F1 26');
console.log('==============================================');
console.log(' UDP:', UDP_PORT);
console.log(' Realtime room:', LIVE_ROOM);
console.log(' Frecuencia web:', PUBLISH_HZ, 'Hz');
console.log(' Persistencia: NINGUNA · datos efímeros');
console.log('==============================================');
console.log('');
telemetry.start();
