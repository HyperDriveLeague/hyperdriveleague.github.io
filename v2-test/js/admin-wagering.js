(() => {
  'use strict';
  const config=window.HYPERDRIVE_CONFIG;
  const root=document.getElementById('adminWageringPanel');
  if(!root||!config||!window.supabase)return;
  const client=window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  const $=id=>document.getElementById(id);
  const PAGE_SIZE=150;
  let view='current';
  let activity=[];
  let loading=false;
  let nextOffset=0;
  let hasMore=false;
  let requestVersion=0;
  const money=value=>Number(value||0).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2});
  const dt=value=>value?new Intl.DateTimeFormat('es-ES',{
    day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'
  }).format(new Date(value)):'—';
  const division=value=>value==='academy'?'Academy':value==='hyperdrive'?'HyperDrive':value||'—';
  const status=value=>({
    pending:'Pendiente',won:'Ganada',lost:'Perdida',void:'Anulada',settled:'Liquidada'
  }[value]||value||'—');
  function el(tag,text,className){
    const node=document.createElement(tag);
    if(text!==undefined)node.textContent=String(text);
    if(className)node.className=className;
    return node;
  }
  function td(tr,text,className){
    const cell=el('td',text,className);
    tr.appendChild(cell);
    return cell;
  }
  function renderSummary(s){
    $('adminWageringTotal').textContent=money(s?.total_staked_m)+' M';
    $('adminWageringBetStake').textContent=money(s?.hyperbet_staked_m)+' M';
    $('adminWageringLotoSales').textContent=money(s?.hyperloto_sales_m)+' M';
    $('adminWageringPaid').textContent=money(s?.total_paid_m)+' M';
    $('adminWageringBetCount').textContent=(s?.hyperbet_bets||0)+' apuestas';
    $('adminWageringLotoCount').textContent=(s?.hyperloto_tickets||0)+' boletos';
  }
  function renderHyperbet(item,rootCell){
    const d=item.details||{};
    const legs=Array.isArray(d.legs)?d.legs:[];
    const title=el('div',(item.detail||'Apuesta')+' · CUOTA TOTAL x'+Number(d.combined_odds||0).toFixed(2),'admin-wagering-pick-title');
    rootCell.appendChild(title);
    if(!legs.length){
      rootCell.appendChild(el('div','Sin detalle de selecciones registrado','admin-wagering-pick-muted'));
    }
    legs.forEach(leg=>{
      const line=el('div',undefined,'admin-wagering-leg');
      const market=el('span',leg.market||'Mercado','admin-wagering-market');
      const pick=el('strong',leg.selection||'Selección','admin-wagering-selection');
      line.append(market,pick);
      if(leg.opponent)line.appendChild(el('span','contra '+leg.opponent,'admin-wagering-pick-muted'));
      if(leg.team)line.appendChild(el('span','('+leg.team+')','admin-wagering-pick-muted'));
      line.appendChild(el('span','x'+Number(leg.odds||0).toFixed(2),'admin-wagering-odd'));
      if(leg.result&&leg.result!=='pending')line.appendChild(el('small',status(leg.result),'admin-wagering-leg-result '+leg.result));
      rootCell.appendChild(line);
    });
  }
  function renderHyperloto(item,rootCell){
    const d=item.details||{};
    rootCell.appendChild(el('div','BOLETO HYPERLOTO · PRONÓSTICO','admin-wagering-pick-title'));
    const poles=el('div',undefined,'admin-wagering-loto-specials');
    poles.appendChild(el('span','POLE: '+(d.pole||'—')+(d.pole_hit===true?' ✓':d.pole_hit===false?' ✕':'')));
    poles.appendChild(el('span','V. RÁPIDA: '+(d.fastest_lap||'—')+(d.fastest_lap_hit===true?' ✓':d.fastest_lap_hit===false?' ✕':'')));
    rootCell.appendChild(poles);
    const title=el('div','TOP 10 PRONOSTICADO','admin-wagering-pick-muted');
    rootCell.appendChild(title);
    const list=el('div',undefined,'admin-wagering-loto-top10');
    const values=Array.isArray(d.top10)?d.top10:[];
    values.forEach((row,i)=>{
      list.appendChild(el('span',(row.position||i+1)+'. '+(row.driver||'—'),'admin-wagering-loto-pos'));
    });
    if(!values.length)list.appendChild(el('span','Sin pronóstico registrado','admin-wagering-pick-muted'));
    rootCell.appendChild(list);
    if(item.status==='settled'){
      const bits=['Posiciones exactas: '+(d.exact_position_hits??0)];
      if(Number(d.reintegro_m)>0)bits.push('Reintegro '+money(d.reintegro_m)+' M');
      if(Number(d.category_prize_m)>0)bits.push('Premio '+money(d.category_prize_m)+' M');
      if(Number(d.jackpot_prize_m)>0)bits.push('Bote '+money(d.jackpot_prize_m)+' M');
      rootCell.appendChild(el('small',bits.join(' · '),'admin-wagering-pick-muted'));
    }
  }
  function renderRows(){
    const body=$('adminWageringBody');
    body.replaceChildren();
    if(!activity.length){
      const row=el('tr');
      td(row,view==='current'
        ?'No hay apuestas pendientes de la ronda actual.'
        :'No se han encontrado apuestas liquidadas para estos filtros.','admin-wagering-empty').colSpan=10;
      body.appendChild(row);
      return;
    }
    const frag=document.createDocumentFragment();
    activity.forEach(item=>{
      const tr=el('tr');
      const product=td(tr,'');
      product.appendChild(el('span',item.activity_type==='hyperbet'?'HYPERBET':'HYPERLOTO',
        'admin-wagering-product '+(item.activity_type==='hyperbet'?'bet':'loto')));
      td(tr,dt(item.activity_at));
      td(tr,'#'+(item.race_number??'--')+' '+(item.driver_name||'Piloto'));
      td(tr,'T'+item.season_number+' · R'+item.round_number+' · '+item.grand_prix);
      td(tr,division(item.division));
      const detail=td(tr,'','admin-wagering-detail');
      if(item.activity_type==='hyperbet')renderHyperbet(item,detail);
      else renderHyperloto(item,detail);
      td(tr,money(item.amount_m)+' M','money');
      td(tr,item.potential_return_m==null?'—':money(item.potential_return_m)+' M','money');
      td(tr,Number(item.payout_m)>0?money(item.payout_m)+' M':'0,00 M','money');
      td(tr,status(item.status),'admin-wagering-state '+String(item.status||''));
      frag.appendChild(tr);
    });
    body.appendChild(frag);
  }
  function showView(){
    const current=view==='current';
    $('adminWageringCurrentView').classList.toggle('active',current);
    $('adminWageringSettledView').classList.toggle('active',!current);
    $('adminWageringCurrentView').setAttribute('aria-pressed',String(current));
    $('adminWageringSettledView').setAttribute('aria-pressed',String(!current));
    $('adminWageringRound').disabled=current;
    if(current)$('adminWageringRound').value='';
    $('adminWageringViewInfo').textContent=current
      ?'Solo apuestas y boletos pendientes de la ronda en curso. Las liquidadas se consultan con el botón de la derecha.'
      :'Historial de apuestas liquidadas, ganadas o perdidas, incluidas las de premio 0 M. Filtra por sistema, división o ronda.';
  }
  async function load(more=false){
    if(loading)return;
    loading=true;
    const thisRequest=++requestVersion;
    const offset=more?nextOffset:0;
    if(!more){activity=[];nextOffset=0;hasMore=false;}
    const notice=$('adminWageringHistoryNotice');
    notice.textContent=more?'Cargando más apuestas…':'Cargando apuestas…';
    $('adminWageringLoadMore').hidden=true;
    const product=$('adminWageringProduct').value||'all';
    const div=$('adminWageringDivision').value||'all';
    const roundRaw=$('adminWageringRound').value;
    try{
      const [history,summary]=await Promise.all([
        client.rpc('admin_wagering_history_v2',{
          p_view:view,p_limit:PAGE_SIZE,p_offset:offset,
          p_product:product,p_division:div,
          p_round_number:view==='settled'&&roundRaw?Number(roundRaw):null
        }),
        !more?client.rpc('admin_wagering_summary'):Promise.resolve(null)
      ]);
      if(history.error)throw history.error;
      if(summary?.error)console.warn('No se pudieron actualizar los totales:',summary.error);
      else if(summary){
        const s=Array.isArray(summary.data)?summary.data[0]:summary.data;
        renderSummary(s);
      }
      if(thisRequest!==requestVersion)return;
      const chunk=history.data||[];
      activity.push(...chunk);
      nextOffset=offset+chunk.length;
      hasMore=chunk.length===PAGE_SIZE;
      renderRows();
      notice.textContent=activity.length+' '+(activity.length===1?'boleto mostrado':'boletos mostrados')+
        (hasMore?' · Quedan más registros disponibles':'')+
        (view==='current'?' · Solo pendientes':' · Incluye premiados y no premiados');
      $('adminWageringLoadMore').hidden=!hasMore;
    }catch(error){
      console.error('Error cargando historial HyperBet/HyperLoto:',error);
      notice.textContent='No se pudo cargar el historial: '+(error?.message||String(error));
      if(!more)renderRows();
    }finally{
      loading=false;
    }
  }
  function switchView(next){
    if(view===next)return;
    view=next;
    showView();
    load();
  }
  ['adminWageringProduct','adminWageringDivision','adminWageringRound'].forEach(id=>{
    $(id).addEventListener('change',()=>load());
  });
  $('adminWageringRefresh').addEventListener('click',()=>load());
  $('adminWageringCurrentView').addEventListener('click',()=>switchView('current'));
  $('adminWageringSettledView').addEventListener('click',()=>switchView('settled'));
  $('adminWageringLoadMore').addEventListener('click',()=>load(true));
  $('adminWageringSettleNow').addEventListener('click',processPendingPayouts);

  async function processPendingPayouts(){
    const button=$('adminWageringSettleNow');
    const note=$('adminWageringCycleStatus');
    if(button.disabled)return;
    if(!window.confirm('¿Ejecutar ahora el ciclo de HyperBet y HyperLoto? Solo liquidará eventos cuyo plazo ya haya vencido. Los eventos ya liquidados no se abonarán de nuevo.'))return;
    button.disabled=true;
    note.textContent='Solicitando la liquidación de premios pendientes…';
    try{
      const result=await client.rpc('admin_refresh_wagering_cycle');
      if(result.error)throw result.error;
      note.textContent='Ciclo solicitado. Comprobando que los eventos hayan quedado liquidados…';
      const started=Date.now();
      let complete=false;
      while(Date.now()-started<70000){
        await new Promise(resolve=>setTimeout(resolve,5000));
        const events=await client.from('wagering_events')
          .select('id,round_number,division,status,settles_at,is_suspended')
          .lte('settles_at',new Date().toISOString())
          .eq('is_suspended',false);
        if(events.error)throw events.error;
        const pending=(events.data||[]).filter(event=>event.status!=='settled');
        if(pending.length===0){
          complete=true;
          note.textContent='Liquidación completada. Premios y movimientos bancarios actualizados.';
          break;
        }
        note.textContent='Esperando confirmación: '+pending.length+' evento(s) pendientes de liquidar.';
      }
      await load();
      if(!complete)note.textContent='El ciclo fue solicitado, pero la liquidación sigue pendiente. Revisa los registros del proceso antes de repetirlo.';
    }catch(error){
      note.textContent='No se pudo ejecutar el ciclo: '+(error?.message||String(error));
    }finally{button.disabled=false;}
  }

  async function init(){
    const {data:{session}}=await client.auth.getSession();
    if(!session)return;
    const check=await client.from('user_roles').select('role')
      .eq('user_id',session.user.id).eq('role','admin').maybeSingle();
    if(!check.data)return;
    showView();
    await load();
  }
  const adminContent=document.getElementById('adminContent');
  if(adminContent&&!adminContent.classList.contains('is-hidden'))init();
  else if(adminContent){
    const obs=new MutationObserver(()=>{
      if(!adminContent.classList.contains('is-hidden')){obs.disconnect();init();}
    });
    obs.observe(adminContent,{attributes:true,attributeFilter:['class']});
  }
})();