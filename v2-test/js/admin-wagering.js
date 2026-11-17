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
  let targetEvents=[];
  let processing=false;
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
        :view==='previous'?'No hay apuestas ni boletos pendientes para esta selección.'
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
    for(const [id,mode] of [['Current','current'],['Previous','previous'],['Settled','settled']]){
      const button=$('adminWagering'+id+'View');
      button.classList.toggle('active',view===mode);
      button.setAttribute('aria-pressed',String(view===mode));
    }
    $('adminWageringRound').disabled=view!=='settled';
    if(view!=='settled')$('adminWageringRound').value='';
    $('adminWageringSettleNow').hidden=view!=='previous';
    $('adminWageringSettleNow').style.display=view==='previous'?'':'none';
    $('adminWageringSettleNow').disabled=true;
    $('adminWageringViewInfo').textContent={
      current:'Apuestas y boletos de la ronda en curso.',
      previous:'Ronda disputada pendiente de liquidación. El botón procesa HyperBet y HyperLoto juntos para la división seleccionada.',
      settled:'Historial de apuestas y boletos liquidados.'
    }[view];
  }

  async function load(more=false){
    if(more&&loading)return;
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
      let targets=[];
      let round=view==='settled'&&roundRaw?Number(roundRaw):null;
      if(view==='previous'){
        $('adminWageringSettleNow').disabled=true;
        const previous=await client.rpc('admin_previous_wagering_events');
        if(previous.error)throw previous.error;
        if(thisRequest!==requestVersion)return;
        const events=previous.data||[];
        const selected=events.filter(e=>div==='all'||e.division===div);
        targets=selected.filter(e=>!e.is_suspended);
        round=events[0]?.round_number??null;
        $('adminWageringViewInfo').textContent=round===null?'No quedan rondas disputadas pendientes.':
          'T'+events[0].season_number+' · R'+round+' · '+events[0].grand_prix+
          '. El pago incluye ambos juegos. Divisiones: '+(targets.map(e=>division(e.division)).join(' y ')||'ninguna disponible')+'.';
      }
      const [history,summary]=await Promise.all([
        client.rpc('admin_wagering_history_v2',{
          p_view:view,p_limit:PAGE_SIZE,p_offset:offset,
          p_product:product,p_division:div,
          p_round_number:round
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
      targetEvents=targets;
      $('adminWageringSettleNow').disabled=processing||!targets.length;
      const chunk=history.data||[];
      activity.push(...chunk);
      nextOffset=offset+chunk.length;
      hasMore=chunk.length===PAGE_SIZE;
      renderRows();
      notice.textContent=activity.length+' '+(activity.length===1?'boleto mostrado':'boletos mostrados')+
        (hasMore?' · Quedan más registros disponibles':'')+
        (view!=='settled'?' · Solo pendientes':' · Incluye premiados y no premiados');
      $('adminWageringLoadMore').hidden=!hasMore;
    }catch(error){
      if(thisRequest!==requestVersion)return;
      console.error('Error cargando historial HyperBet/HyperLoto:',error);
      notice.textContent='No se pudo cargar el historial: '+(error?.message||String(error));
      if(!more)renderRows();
    }finally{
      if(thisRequest===requestVersion)loading=false;
    }
  }
  function switchView(next){
    if(view===next)return;
    targetEvents=[];
    view=next;
    showView();
    load();
  }
  ['adminWageringProduct','adminWageringDivision','adminWageringRound'].forEach(id=>{
    $(id).addEventListener('change',()=>load());
  });
  $('adminWageringRefresh').addEventListener('click',()=>load());
  $('adminWageringPreviousView').addEventListener('click',()=>switchView('previous'));
  $('adminWageringCurrentView').addEventListener('click',()=>switchView('current'));
  $('adminWageringSettledView').addEventListener('click',()=>switchView('settled'));
  $('adminWageringLoadMore').addEventListener('click',()=>load(true));
  $('adminWageringSettleNow').addEventListener('click',processPendingPayouts);

  async function processPendingPayouts(){
    const button=$('adminWageringSettleNow');
    const note=$('adminWageringCycleStatus');
    if(view!=='previous'||processing||loading||button.disabled||!targetEvents.length)return;
    const events=targetEvents.slice();
    const label='R'+events[0].round_number+' · '+events[0].grand_prix+' · '+events.map(e=>division(e.division)).join(' y ');
    if(!window.confirm('¿Procesar las apuestas y boletos de '+label+' y abonar sus premios?'))return;
    processing=true;
    button.disabled=true;
    note.textContent='Procesando '+label+'…';
    try{
      const {data,error}=await client.functions.invoke('hyperdrive-wagering-cycle',{
        body:{action:'settle_previous',event_ids:events.map(e=>e.id)}
      });
      if(error)throw error;
      if(!Array.isArray(data?.report)||!data.report.length)throw new Error('Respuesta incompleta.');
      const messages={settled:'liquidada',already_settled:'ya liquidada',suspended:'suspendida',error:'error al procesar',
        waiting_lineup:'falta la alineación',waiting_top10:'falta el top 10 oficial',waiting_loto_pole:'falta la pole oficial',
        waiting_loto_fastest:'falta la vuelta rápida oficial'};
      note.textContent=label+' — '+data.report.map(row=>division(row.division)+': '+(messages[row.result]||'pendiente de resultados oficiales')).join(' · ');
    }catch(error){
      note.textContent='No se pudo confirmar la liquidación de '+label+'. '+(error?.message||String(error));
    }finally{
      processing=false;
      await load();
    }
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