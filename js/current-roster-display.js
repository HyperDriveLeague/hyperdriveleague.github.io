/* Read-only current-team presentation overlay.
   Racing data and historical constructor points remain sourced solely from
   immutable race-result JSON; this map changes DISPLAY labels only. */
(() => {
  'use strict';
  const supabaseUrl='https://knyxattsjimsjefydcad.supabase.co';
  const publishableKey='sb_publishable_hLAzZZF6kki1xZ0Kyx6lfA_97kzSAmf';
  const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  let current=null,request=null,official=null;
  function load(){
    if(request)return request;
    request=fetch(supabaseUrl+'/rest/v1/rpc/public_driver_grid',{
      method:'POST',
      headers:{apikey:publishableKey,'Content-Type':'application/json'},
      body:JSON.stringify({p_season_number:8}),
      cache:'no-store'
    }).then(async response=>{
      if(!response.ok)throw new Error('Roster HTTP '+response.status);
      const rows=await response.json();
      if(!Array.isArray(rows))throw new Error('Formato de alineación no válido');
      current=new Map();
      official={hyperdrive:new Map(),academy:new Map()};
      rows.forEach(row=>{
        const division=String(row.division||'').toLowerCase();
        const k=division+':'+normalize(row.driver_name);
        if(division&&row.driver_name){
          current.set(k,String(row.team_name||'').trim()||'SIN EQUIPO');
          if (official[division] && String(row.team_name||'').trim()) {
            official[division].set(normalize(row.driver_name), {driverName:String(row.driver_name),teamName:String(row.team_name)});
          }
        }
      });
      return current;
    }).catch(error=>{
      console.warn('Roster actual no disponible: se mantiene la información histórica',error);
      return null;
    });
    return request;
  }
  function displayName(name,division,historicalName){
    return current?.get(String(division||'').toLowerCase()+':'+normalize(name))
      ||historicalName||'SIN EQUIPO';
  }
  function officialDrivers(division){return official?.[division] || null;}
  window.HyperdriveCurrentRoster=Object.freeze({load,displayName,officialDrivers});
})();