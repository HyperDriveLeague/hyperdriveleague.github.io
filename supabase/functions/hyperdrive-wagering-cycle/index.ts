
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RAW_BASE = "https://raw.githubusercontent.com/HyperDriveLeague/hyperdriveleague.github.io/main/data";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function expectedCronSecret() {
  const { data, error } = await db.rpc("internal_get_wagering_cron_secret");
  if (error || !data) throw error || new Error("Missing wagering scheduler secret");
  return data;
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const round2 = v => Math.round(v * 100) / 100;
const norm = (value = "") =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

async function fetchJson(path) {
  const res = await fetch(RAW_BASE + "/" + path, { headers: { "cache-control": "no-cache" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(path + ": " + res.status);
  return await res.json();
}

function driverName(row) {
  return row?.driverInfo?.displayName || row?.driverName || "";
}

function classificationPosition(row) {
  const p = Number(row?.classificationPosition ?? row?.position);
  return Number.isFinite(p) && p > 0 ? p : null;
}

function fastestMs(row) {
  const direct = Number(row?.fastestLapTimeMs);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const laps = Array.isArray(row?.laps) ? row.laps : [];
  const valid = laps
    .filter(l => l?.isValid !== false && Number(l?.lapTimeMs) > 0)
    .map(l => Number(l.lapTimeMs));
  return valid.length ? Math.min(...valid) : null;
}

async function getLineup(event) {
  const { data, error } = await db
    .from("season_roster")
    .select("driver_id,division,roster_status,start_round,end_round,drivers:driver_id(id,nickname,race_number),teams:team_id(name)")
    .eq("season_number", event.season_number)
    .eq("division", event.division)
    .eq("roster_status", "official")
    .lte("start_round", event.round_number);

  if (error) throw error;

  const rows=(data || []).filter(x => x.end_round == null || Number(x.end_round) >= Number(event.round_number));
  const ids=[...new Set(rows.map(x=>x.driver_id).filter(Boolean))];
  let aliasRows=[];
  if(ids.length){
    const aliasResponse=await db.from("driver_result_aliases").select("driver_id,normalized_alias").in("driver_id",ids);
    if(aliasResponse.error) throw aliasResponse.error;
    aliasRows=aliasResponse.data || [];
  }

  const aliasesByDriver=new Map();
  for(const a of aliasRows){
    if(!aliasesByDriver.has(a.driver_id)) aliasesByDriver.set(a.driver_id,[]);
    aliasesByDriver.get(a.driver_id).push(a.normalized_alias);
  }

  return rows.map(x => {
    const key=norm(x.drivers?.nickname || "");
    const keys=[...new Set([key,...(aliasesByDriver.get(x.driver_id)||[])].filter(Boolean))];
    return {
      id:x.driver_id,
      nickname:x.drivers?.nickname || "Piloto",
      race_number:x.drivers?.race_number ?? null,
      team:x.teams?.name || "",
      key,
      keys
    };
  });
}

function emptyStats() {
  return {
    starts: 0, qstarts: 0, wins: 0, podiums: 0, top5: 0, top10: 0,
    finishes: 0, poles: 0, fastest: 0,
    racePositions: [], qualPositions: [], recentRace: [], recentQual: []
  };
}

async function loadStats(event, lineup) {
  const stats = new Map();
  lineup.forEach(d => {
    const record=emptyStats();
    (d.keys || [d.key]).forEach(key => stats.set(key, record));
  });

  for (let round = 1; round < Number(event.round_number); round += 1) {
    const [race, qual] = await Promise.all([
      fetchJson(event.division + "_r" + round + ".json").catch(() => null),
      fetchJson(event.division + "_qr" + round + ".json").catch(() => null)
    ]);

    if (race?.session?.drivers) {
      const fastestName = norm(race?.session?.fastestLap?.driverName || "");
      for (const row of race.session.drivers) {
        const key = norm(driverName(row));
        const s = stats.get(key);
        if (!s) continue;
        const pos = classificationPosition(row);
        s.starts += 1;
        if (pos) {
          s.racePositions.push(pos);
          s.recentRace.push(pos);
          if (s.recentRace.length > 3) s.recentRace.shift();
          if (pos === 1) s.wins += 1;
          if (pos <= 3) s.podiums += 1;
          if (pos <= 5) s.top5 += 1;
          if (pos <= 10) s.top10 += 1;
        }
        const status = String(row?.status || "").toLowerCase();
        if (!status.includes("dnf") && !status.includes("dsq") && !status.includes("disqualified")) s.finishes += 1;
        if (fastestName && key === fastestName) s.fastest += 1;
      }
    }

    if (qual?.session?.drivers) {
      for (const row of qual.session.drivers) {
        const key = norm(driverName(row));
        const s = stats.get(key);
        if (!s) continue;
        const pos = classificationPosition(row);
        s.qstarts += 1;
        if (pos) {
          s.qualPositions.push(pos);
          s.recentQual.push(pos);
          if (s.recentQual.length > 3) s.recentQual.shift();
          if (pos === 1) s.poles += 1;
        }
      }
    }
  }
  return stats;
}

function avg(arr, fallback) {
  return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : fallback;
}

function posScore(arr, n) {
  const a = avg(arr, (n + 1) / 2);
  return clamp((n + 1 - a) / n, 0, 1);
}

function smoothed(successes, starts, priorProb, priorWeight=3) {
  return (successes + priorProb * priorWeight) / (starts + priorWeight);
}

function calculateRatings(lineup, stats) {
  const n = Math.max(2, lineup.length);
  return lineup.map(d => {
    const s = stats.get(d.key) || emptyStats();
    const racePos = posScore(s.racePositions, n);
    const recentRace = posScore(s.recentRace, n);
    const qualPos = posScore(s.qualPositions, n);
    const recentQual = posScore(s.recentQual, n);
    const winRate = smoothed(s.wins, s.starts, 1/n);
    const podiumRate = smoothed(s.podiums, s.starts, 3/n);
    const top5Rate = smoothed(s.top5, s.starts, Math.min(1,5/n));
    const top10Rate = smoothed(s.top10, s.starts, Math.min(1,10/n));
    const finishRate = smoothed(s.finishes, s.starts, .85);
    const poleRate = smoothed(s.poles, s.qstarts, 1/n);
    const fastestRate = smoothed(s.fastest, s.starts, 1/n);

    const winnerScore = .30*racePos + .25*winRate + .20*podiumRate + .15*recentRace + .10*qualPos;
    const poleScore = .45*qualPos + .30*poleRate + .25*recentQual;
    const podiumScore = .35*podiumRate + .30*racePos + .20*recentRace + .15*qualPos;
    const top5Score = .40*top5Rate + .30*racePos + .20*recentRace + .10*finishRate;
    const top10Score = .45*top10Rate + .25*racePos + .20*finishRate + .10*recentRace;
    const fastestScore = .40*fastestRate + .30*racePos + .20*recentRace + .10*qualPos;

    return {
      ...d, s,
      winnerScore, poleScore, podiumScore, top5Score, top10Score, fastestScore,
      podiumProb: clamp(.65*podiumRate + .35*podiumScore, .05, .92),
      top5Prob: clamp(.65*top5Rate + .35*top5Score, .08, .95),
      top10Prob: clamp(.65*top10Rate + .35*top10Score, .12, .97)
    };
  });
}

function relativeOddsTable(ratings, field, topOdds, maxOdds) {
  const scores = ratings.map(r => Number(r[field] || 0));
  const lo = Math.min(...scores);
  const hi = Math.max(...scores);
  const span = Math.max(.000001, hi - lo);
  return new Map(ratings.map(r => {
    const rel = (Number(r[field] || 0) - lo) / span;
    return [r.id, round2(maxOdds - rel * (maxOdds - topOdds))];
  }));
}

function oddsFromP(p, min, max, edge=.08) {
  return round2(clamp(1 / Math.max(.001, p * (1 + edge)), min, max));
}

async function ensureMarkets(event) {
  const lineup = await getLineup(event);
  if (!lineup.length) return "no_lineup";

  const stats = await loadStats(event, lineup);
  const ratings = calculateRatings(lineup, stats);
  const winnerOdds = relativeOddsTable(ratings,"winnerScore",2.20,6.00);
  const poleOdds = relativeOddsTable(ratings,"poleScore",2.30,6.00);
  const fastOdds = relativeOddsTable(ratings,"fastestScore",2.50,6.00);

  const defs = [
    { type:"winner", code:"winner", title:"GANADOR", order:10, min:1.40, max:6.00, odds:r=>winnerOdds.get(r.id) || 6.00, score:"winnerScore" },
    { type:"pole", code:"pole", title:"POLE POSITION", order:20, min:1.50, max:6.00, odds:r=>poleOdds.get(r.id) || 6.00, score:"poleScore" },
    { type:"podium", code:"podium", title:"PODIO", order:30, min:1.15, max:4.00, p:r=>r.podiumProb, score:"podiumScore" },
    { type:"top5", code:"top5", title:"TOP 5", order:40, min:1.08, max:3.00, p:r=>r.top5Prob, score:"top5Score" },
    { type:"top10", code:"top10", title:"TOP 10", order:50, min:1.03, max:2.20, p:r=>r.top10Prob, score:"top10Score" },
    { type:"fastest_lap", code:"fastest_lap", title:"VUELTA RÁPIDA", order:60, min:1.60, max:6.00, odds:r=>fastOdds.get(r.id) || 6.00, score:"fastestScore" }
  ];

  const marketResponse=await db
    .from("hyperbet_markets")
    .select("id,market_type,market_code,status")
    .eq("event_id",event.id);
  if(marketResponse.error) throw marketResponse.error;

  const existingMarkets=marketResponse.data || [];
  const lineupIds=new Set(lineup.map(d=>d.id));
  let createdAny=false;
  let syncedAny=false;

  for(const def of defs){
    let market=existingMarkets.find(m=>m.market_code===def.code);
    if(!market){
      const mInsert=await db.from("hyperbet_markets").insert({
        event_id:event.id,
        market_type:def.type,
        market_code:def.code,
        title:def.title,
        sort_order:def.order,
        status:event.status==="closed" ? "closed" : "open"
      }).select("id,market_type,market_code,status").single();
      if(mInsert.error) throw mInsert.error;
      market=mInsert.data;
      createdAny=true;
    }

    const selectionResponse=await db
      .from("hyperbet_selections")
      .select("id,driver_id,is_active")
      .eq("market_id",market.id);
    if(selectionResponse.error) throw selectionResponse.error;
    const existingSelections=selectionResponse.data || [];
    const byDriver=new Map(existingSelections.map(s=>[s.driver_id,s]));

    const deactivateIds=existingSelections.filter(s=>!lineupIds.has(s.driver_id) && s.is_active).map(s=>s.id);
    if(deactivateIds.length){
      const u=await db.from("hyperbet_selections").update({is_active:false}).in("id",deactivateIds);
      if(u.error) throw u.error;
      syncedAny=true;
    }

    for(let idx=0;idx<ratings.length;idx+=1){
      const r=ratings[idx];
      const odds=def.odds ? Number(def.odds(r)) : oddsFromP(Number(def.p(r)),def.min,def.max);
      const existing=byDriver.get(r.id);
      if(existing){
        const u=await db.from("hyperbet_selections").update({
          selection_label:r.nickname,
          team_label:r.team,
          stats_score:Number(r[def.score] || 0),
          sort_order:idx+1,
          is_active:true
        }).eq("id",existing.id);
        if(u.error) throw u.error;
        if(!existing.is_active) syncedAny=true;
      }else{
        const ins=await db.from("hyperbet_selections").insert({
          market_id:market.id,
          driver_id:r.id,
          selection_label:r.nickname,
          team_label:r.team,
          initial_odds:odds,
          current_odds:odds,
          min_odds:def.min,
          max_odds:def.max,
          stats_score:Number(r[def.score] || 0),
          sort_order:idx+1,
          is_active:true
        });
        if(ins.error) throw ins.error;
        syncedAny=true;
      }
    }

    const repriced=await db.rpc("hyperbet_reprice_market",{p_market_id:market.id});
    if(repriced.error) throw repriced.error;
  }

  if(createdAny) return "created";
  return syncedAny ? "synced" : "exists";
}

function mapOfficial(lineup) {
  const map=new Map();
  lineup.forEach(d => (d.keys || [d.key]).forEach(key => map.set(key,d)));
  return map;
}

function checkRoundSixBettingSources(event, race, qual) {
  // R6 (Hungary) uses F2 cars, but bets settle ONLY from the feature/main race.
  // In particular, the reversed-grid Sprint never counts for HyperBet or HyperLoto.
  if (Number(event.season_number) !== 8 || Number(event.round_number) !== 6) return null;
  if (Number(race?.event?.round) !== 6 || Number(qual?.event?.round) !== 6)
    return "waiting_r6_matching_results";
  const raceSession = String(race?.session?.sessionInfo?.sessionType || "").toLowerCase();
  const raceSubtype = String(race?.session?.sessionInfo?.raceType || "").toLowerCase();
  const qualSession = String(qual?.session?.sessionInfo?.sessionType || "").toLowerCase();
  if (!raceSession.includes("race") || raceSubtype.includes("sprint"))
    return "waiting_r6_main_race";
  if (!qualSession.includes("qual"))
    return "waiting_r6_qualy";
  return null;
}

async function settleEvent(event) {
  const noQualifying = event.season_number === 8 && event.round_number === 9;
  const [race, qual] = await Promise.all([
    fetchJson(event.division + "_r" + event.round_number + ".json"),
    noQualifying ? null : fetchJson(event.division + "_qr" + event.round_number + ".json")
  ]);
  const completed = (file, type) => Number(file?.event?.round) === event.round_number &&
    file?.session?.sessionInfo?.completedStatus === "Completed" &&
    file.session.sessionInfo.sessionType === type && file.session.drivers?.length > 0;
  if (!completed(race, "Race") || race.session.sessionInfo.raceType !== "Main" ||
      (!noQualifying && !completed(qual, "Qualification"))) return "waiting_results";
  const invalidSource = checkRoundSixBettingSources(event, race, qual);
  if (invalidSource) return invalidSource;

  const lineup = await getLineup(event);
  const official = mapOfficial(lineup);
  if (!lineup.length) return "waiting_lineup";

  const raceRows = [...(race?.session?.drivers || [])]
    .sort((a,b)=>(classificationPosition(a) || 999)-(classificationPosition(b) || 999));
  const qualRows = [...(qual?.session?.drivers || [])]
    .sort((a,b)=>(classificationPosition(a) || 999)-(classificationPosition(b) || 999));

  const actualPositions = {};
  for (const row of raceRows) {
    const d=official.get(norm(driverName(row)));
    const pos=classificationPosition(row);
    // A driver present in the race file but without a valid classification
    // (DNF/DSQ) is NOT absent. Keep him with an out-of-points rank.
    if (d) actualPositions[d.id]=pos ?? 9999;
  }

  const rawPole = qualRows[0] ? official.get(norm(driverName(qualRows[0]))) : null;
  const rawFastName = norm(race?.session?.fastestLap?.driverName || "");
  const rawFast = rawFastName ? official.get(rawFastName) : null;

  const compactRace = raceRows
    .map(row=>official.get(norm(driverName(row))))
    .filter(Boolean);
  const lotoTop10 = compactRace.slice(0,10).map(d=>d.id);
  if (lotoTop10.length<10) return "waiting_top10";

  const lotoPoleRow = qualRows.find(row=>official.has(norm(driverName(row))));
  const lotoPole = lotoPoleRow ? official.get(norm(driverName(lotoPoleRow))) : null;
  if (!noQualifying && !lotoPole) return "waiting_loto_pole";

  let lotoFast = null;
  let best = Infinity;
  for (const row of raceRows) {
    const d=official.get(norm(driverName(row)));
    if (!d) continue;
    const ms=fastestMs(row);
    if (ms && ms<best) { best=ms; lotoFast=d; }
  }
  if (rawFast) lotoFast=rawFast;
  if (!lotoFast) return "waiting_loto_fastest";

  const { data, error } = await db.rpc("system_settle_wagering_event", {
    p_event_id:event.id,
    p_actual_positions:actualPositions,
    p_actual_pole_driver_id:rawPole?.id || null,
    p_actual_fastest_driver_id:rawFast?.id || null,
    p_loto_top10:lotoTop10,
    p_loto_pole_driver_id:lotoPole?.id || null,
    p_loto_fastest_driver_id:lotoFast.id
  });
  if (error) throw error;
  return data;
}

async function cycle() {
  const now = new Date();
  const { data:events,error }=await db
    .from("wagering_events")
    .select("*")
    .neq("status","settled")
    .order("race_at");
  if(error) throw error;

  const report=[];
  for(const event of events || []) {
    if(event.is_suspended) {
      report.push({event:event.id,status:"suspended"});
      continue;
    }

    const opens=new Date(event.opens_at), closes=new Date(event.closes_at);
    let desired="upcoming";
    if(now>=opens && now<closes) desired="open";
    else if(now>=closes) desired="closed";

    if(event.status!==desired && event.status!=="settled") {
      const { error:uErr }=await db.from("wagering_events").update({status:desired,updated_at:new Date().toISOString()}).eq("id",event.id).neq("status","settled");
      if(uErr) throw uErr;
      event.status=desired;
    }

    if(now>=opens) {
      const marketStatus = await ensureMarkets(event);
      if(now>=closes) {
        const { error:cErr }=await db.from("hyperbet_markets").update({status:"closed"}).eq("event_id",event.id).eq("status","open");
        if(cErr) throw cErr;
      }

      const { data:draw,error:dErr }=await db.from("hyperloto_draws").select("id,jackpot_opening_m").eq("event_id",event.id).maybeSingle();
      if(dErr) throw dErr;
      if(draw && draw.jackpot_opening_m==null) {
        const { data:jp,error:jErr }=await db.from("hyperloto_jackpots").select("current_m").eq("division",event.division).single();
        if(jErr) throw jErr;
        const { error:duErr }=await db.from("hyperloto_draws").update({jackpot_opening_m:jp?.current_m || 40}).eq("id",draw.id);
        if(duErr) throw duErr;
      }
      report.push({event:event.id,markets:marketStatus,status:desired});
    }


  }
  return report;
}

Deno.serve(async req => {
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, x-client-info, content-type", "access-control-allow-methods": "POST, OPTIONS", "content-type": "application/json" };
  if (req.method === "OPTIONS") return new Response(null, {headers:cors});
  if (req.method !== "POST") return new Response(null, {status:405,headers:cors});
  if (!req.headers.has("x-hyperdrive-cron-secret")) {
    const reply = (body, status=200) => new Response(JSON.stringify(body), {status,headers:cors});
    const authorization = req.headers.get("authorization");
    if (!authorization) return reply({error:"Sesión requerida"},401);
    try {
      const input = await req.json();
      if (input.action !== "settle_previous" || !Array.isArray(input.event_ids) || !input.event_ids.length) {
        return reply({error:"Selecciona una ronda pendiente"},400);
      }
      const caller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY"), {
        global:{headers:{Authorization:authorization}}, auth:{persistSession:false,autoRefreshToken:false}
      });
      const {data:pending,error} = await caller.rpc("admin_previous_wagering_events");
      if (error) return reply({error:"Acceso de administración requerido"},403);
      const expected = new Set(input.event_ids);
      const eligible = pending.filter(event => expected.has(event.id));
      if (eligible.length !== expected.size) return reply({error:"La ronda ha cambiado. Actualiza la lista."},409);
      const report = [];
      for (const event of eligible) {
        try {
          const result = event.is_suspended ? "suspended" : await settleEvent(event);
          report.push({division:event.division,result});
        } catch (error) {
          console.error(event.id,error);
          report.push({division:event.division,result:"error"});
        }
      }
      return reply({report});
    } catch (error) {
      console.error(error);
      return reply({error:"No se pudo procesar la solicitud"},500);
    }
  }
  const cronSecret = await expectedCronSecret();
  if (req.headers.get("x-hyperdrive-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({error:"unauthorized"}), {status:401,headers:{"content-type":"application/json"}});
  }
  try {
    const report=await cycle();
    return new Response(JSON.stringify({ok:true,report}), {headers:{"content-type":"application/json"}});
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ok:false,error:String(error?.message || error)}), {status:500,headers:{"content-type":"application/json"}});
  }
});
