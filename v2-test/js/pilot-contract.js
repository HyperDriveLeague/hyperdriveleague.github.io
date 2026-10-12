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
   const {data:contracts,error:ce}=await db.from('driver_contracts').select('id,team_account_id,driver_value_m,buyout_clause_m,contract_end_label,status').eq('driver_id',driverId).eq('status','active');
   if(ce)throw ce;
   if(!contracts?.length){target.innerHTML='<p class="muted">Ahora mismo no tienes ningún contrato vigente.</p>';return;}
   const {data:terms,error:te}=await db.from('contract_terms').select('contract_id,end_half,periods,paid_total_m,imported_legacy').in('contract_id',contracts.map(x=>x.id));
   if(te)throw te;
   const termMap=new Map((terms||[]).map(x=>[x.contract_id,x]));
   const current=contracts.filter(c=>!termMap.has(c.id)||Number(termMap.get(c.id).end_half)>=2*cfg.currentSeason);
   if(!current.length){target.innerHTML='<p class="muted">Tu último contrato ha vencido. Actualmente estás sin contrato.</p>';return;}
   const c=current[current.length-1];const t=termMap.get(c.id);
   const balance=t?(t.periods||[]).filter(p=>Number(p.half)>=cfg.currentSeason*2).reduce((a,p)=>a+Number(p.amount||0),0):Number(c.driver_value_m);
   const paid=t?t.paid_total_m:c.driver_value_m,clause=t?balance*1.5:c.buyout_clause_m;
   const {data:account}=await db.from('team_accounts').select('team_id,teams:team_id(name)').eq('id',c.team_account_id).maybeSingle();
   target.innerHTML=
    box('Escudería',account?.teams?.name||'—')+
    box('Valor pagado',money(paid))+
    box('Cláusula vigente',money(clause))+
    box('Vencimiento',t?expiry(t.end_half):c.contract_end_label||'Por especificar')+
    '<p class="pilot-contract-caption">La cláusula se reduce al cambiar de temporada, no durante el mercado de mitad de temporada. Los importes de contratos anteriores se conservan sin volver a cobrarse.</p>';
  }catch(e){console.error('Pilot contract:',e);target.innerHTML='<p class="muted">No se pudo cargar el contrato.</p>';}
 };
})();