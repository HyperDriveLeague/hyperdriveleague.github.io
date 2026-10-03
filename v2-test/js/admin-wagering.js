(() => {
  const config=window.HYPERDRIVE_CONFIG;
  const client=window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const root=document.getElementById('adminWageringPanel');
  if(!root)return;
  const $=id=>document.getElementById(id);
  const money=v=>Number(v||0).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2});
  const dt=v=>v?new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(v)):'—';
  const division=v=>v==='academy'?'Academy':v==='hyperdrive'?'HyperDrive':v||'—';
  const status=v=>({pending:'Pendiente',won:'Ganada',lost:'Perdida',void:'Anulada',settled:'Liquidado'}[v]||v||'—');

  function renderSummary(s){
    $('adminWageringTotal').textContent=money(s?.total_staked_m)+' M';
    $('adminWageringBetStake').textContent=money(s?.hyperbet_staked_m)+' M';
    $('adminWageringLotoSales').textContent=money(s?.hyperloto_sales_m)+' M';
    $('adminWageringPaid').textContent=money(s?.total_paid_m)+' M';
    $('adminWageringBetCount').textContent=(s?.hyperbet_bets||0)+' apuestas';
    $('adminWageringLotoCount').textContent=(s?.hyperloto_tickets||0)+' boletos';
  }

  function renderRows(items){
    const body=$('adminWageringBody');body.innerHTML='';
    if(!items.length){
      const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=10;td.className='admin-wagering-empty';td.textContent='Todavía no hay actividad registrada.';tr.appendChild(td);body.appendChild(tr);return;
    }
    items.forEach(item=>{
      const tr=document.createElement('tr');
      const product=document.createElement('td');
      const badge=document.createElement('span');
      badge.className='admin-wagering-product '+(item.activity_type==='hyperbet'?'bet':'loto');
      badge.textContent=item.activity_type==='hyperbet'?'HYPERBET':'HYPERLOTO';
      product.appendChild(badge);tr.appendChild(product);

      const vals=[
        dt(item.activity_at),
        '#'+(item.race_number??'--')+' '+item.driver_name,
        'T'+item.season_number+' · R'+item.round_number+' · '+item.grand_prix,
        division(item.division),
        item.detail||'—'
      ];
      vals.forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.appendChild(td);});

      const amount=document.createElement('td');amount.className='money';amount.textContent=money(item.amount_m)+' M';tr.appendChild(amount);
      const potential=document.createElement('td');potential.className='money';potential.textContent=item.potential_return_m==null?'—':money(item.potential_return_m)+' M';tr.appendChild(potential);
      const payout=document.createElement('td');payout.className='money';payout.textContent=Number(item.payout_m)>0?money(item.payout_m)+' M':'—';tr.appendChild(payout);
      const st=document.createElement('td');st.textContent=status(item.status);tr.appendChild(st);
      body.appendChild(tr);
    });
  }

  async function load(){
    const product=$('adminWageringProduct').value||'all';
    const div=$('adminWageringDivision').value||'all';
    const roundRaw=$('adminWageringRound').value;
    const [sumRes,histRes]=await Promise.all([
      client.rpc('admin_wagering_summary'),
      client.rpc('admin_wagering_history',{
        p_limit:500,
        p_product:product,
        p_division:div,
        p_round_number:roundRaw?Number(roundRaw):null
      })
    ]);
    if(sumRes.error||histRes.error){
      console.error(sumRes.error||histRes.error);
      renderRows([]);
      return;
    }
    const s=Array.isArray(sumRes.data)?sumRes.data[0]:sumRes.data;
    renderSummary(s);
    renderRows(histRes.data||[]);
  }

  ['adminWageringProduct','adminWageringDivision','adminWageringRound'].forEach(id=>{
    $(id).addEventListener('change',load);
  });
  $('adminWageringRefresh').addEventListener('click',load);

  async function init(){
    const {data:{session}}=await client.auth.getSession();if(!session)return;
    const check=await client.from('user_roles').select('role').eq('user_id',session.user.id).eq('role','admin').maybeSingle();
    if(!check.data)return;
    await load();
  }

  const adminContent=document.getElementById('adminContent');
  if(adminContent&&!adminContent.classList.contains('is-hidden'))init();
  else if(adminContent){
    const obs=new MutationObserver(()=>{if(!adminContent.classList.contains('is-hidden')){obs.disconnect();init();}});
    obs.observe(adminContent,{attributes:true,attributeFilter:['class']});
  }
})();