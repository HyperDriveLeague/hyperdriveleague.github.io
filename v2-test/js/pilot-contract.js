(() => {
 const cfg=window.HYPERDRIVE_CONFIG;
 if(!cfg||!window.supabase)return;
 const db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const money=v=>Number(v||0).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' M';
 const expiry=h=>'T'+Math.floor(h/2)+(h%2?' · final de temporada':' · mitad de temporada');
 const box=(title,val)=>'<div class="pilot-contract-metric"><span>'+esc(title)+'</span><strong>'+esc(val)+'</strong></div>';
 window.renderPilotContract=async function(driverId){
  const target=document.getElementById('pilotContractPanel');if(!target)return;
  target.innerHTML='<p class="muted">Cargando contrato…</p>';
  try{
   const {data:session}=await db.auth.getSession();
   if(!session.session)return;
   const {data:profile,error:pe}=await db.from('profiles').select('driver_id').eq('id',session.session.user.id).maybeSingle();
   if(pe||!profile||profile.driver_id!==driverId){target.textContent='No se puede consultar este contrato.';return;}
   const [principalResp,rosterResp]=await Promise.all([
    db.from('team_principals').select('team_id').eq('user_id',session.session.user.id).eq('season_number',cfg.currentSeason).eq('is_active',true).maybeSingle(),
    db.from('season_roster').select('team_id,teams:team_id(name)').eq('driver_id',driverId).eq('season_number',cfg.currentSeason).eq('is_active',true).maybeSingle()
   ]);
   if(principalResp.error)throw principalResp.error;
   if(rosterResp.error)throw rosterResp.error;
   const principal=principalResp.data,activeRoster=rosterResp.data;
   const allResponse=await db.from('driver_contracts').select('id,team_account_id,driver_value_m,buyout_clause_m,contract_end_label,status,is_team_principal_contract').eq('driver_id',driverId).eq('status','active');
   if(allResponse.error)throw allResponse.error;
   if((allResponse.data||[]).some(c=>c.is_team_principal_contract)||(principal?.team_id&&principal.team_id===activeRoster?.team_id)){
     target.innerHTML=box('Situación','TEAM PRINCIPAL')+box('Escudería',activeRoster?.teams?.name||'Equipo propio')+
      '<p class="pilot-contract-caption"><strong>Piloto propietario de su escudería.</strong> No tienes contrato como piloto, cláusula de rescisión ni vencimiento; tampoco ocupas salary cap por contrato.</p>';
     return;
   }
   const contracts=(allResponse.data||[]).filter(c=>!c.is_team_principal_contract);
   if(!contracts?.length){target.innerHTML='<p class="muted">Ahora mismo no tienes ningún contrato vigente.</p>';return;}
   const {data:terms,error:te}=await db.from('contract_terms').select('contract_id,end_half,periods,paid_total_m,imported_legacy').in('contract_id',contracts.map(x=>x.id));
   if(te)throw te;
   const termMap=new Map((terms||[]).map(x=>[x.contract_id,x]));
   const current=contracts.filter(c=>!termMap.has(c.id)||Number(termMap.get(c.id).end_half)>=2*cfg.currentSeason);
   if(!current.length){target.innerHTML='<p class="muted">Tu último contrato ha vencido. Actualmente estás sin contrato.</p>';return;}
   const c=current[current.length-1];const t=termMap.get(c.id);
   const balance=t?(t.periods||[]).filter(p=>Number(p.half)>=cfg.currentSeason*2).reduce((a,p)=>a+Number(p.amount||0),0):Number(c.driver_value_m);
   const paid=t?t.paid_total_m:c.driver_value_m,clause=t?balance*1.5:c.buyout_clause_m;
   target.innerHTML=
    box('Escudería',activeRoster?.teams?.name||'—')+
    box('Valor pagado',money(paid))+
    box('Cláusula vigente',money(clause))+
    box('Vencimiento',t?expiry(t.end_half):c.contract_end_label||'Por especificar')+
    '<p class="pilot-contract-caption">La cláusula se reduce al cambiar de temporada, no durante el mercado de mitad de temporada. Los importes de contratos anteriores se conservan sin volver a cobrarse.</p>';
  }catch(e){console.error('Pilot contract:',e);target.innerHTML='<p class="muted">No se pudo cargar el contrato.</p>';}
 };
})();