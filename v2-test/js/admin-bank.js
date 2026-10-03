(() => {
  const config=window.HYPERDRIVE_CONFIG;
  const client=window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const adminContent=document.getElementById('adminContent');
  const select=document.getElementById('adminBankDriverSelect');
  const empty=document.getElementById('adminBankEmpty');
  const content=document.getElementById('adminBankContent');
  if(!adminContent||!select||!empty||!content) return;

  const $=id=>document.getElementById(id);
  const money=v=>Number(v||0).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2});
  const dt=v=>v?new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v)):'—';

  function renderHistory(items){
    const body=$('adminBankHistoryBody');
    body.innerHTML='';
    if(!items.length){
      const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=4;td.textContent='No hay movimientos registrados.';tr.appendChild(td);body.appendChild(tr);return;
    }
    items.forEach(item=>{
      const tr=document.createElement('tr');
      [dt(item.transaction_at),item.description||'Movimiento',item.category||'—'].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.appendChild(td);});
      const amount=document.createElement('td');
      const income=item.direction==='income';
      amount.className=income?'admin-bank-positive':'admin-bank-negative';
      amount.textContent=(income?'+':'−')+money(item.amount_m)+' M';
      tr.appendChild(amount);body.appendChild(tr);
    });
  }

  async function loadBank(driverId){
    empty.textContent='Cargando banco…';
    empty.classList.remove('is-hidden');
    content.classList.add('is-hidden');

    const [dashRes,historyRes]=await Promise.all([
      client.rpc('admin_driver_bank_dashboard',{p_driver_id:driverId}),
      client.rpc('admin_driver_bank_history',{p_driver_id:driverId,p_limit:120})
    ]);
    const bad=[dashRes,historyRes].find(r=>r.error);
    if(bad){
      console.error(bad.error);
      empty.textContent=bad.error?.message||'No se pudo cargar el banco del piloto.';
      return;
    }
    const data=Array.isArray(dashRes.data)?dashRes.data[0]:dashRes.data;
    if(!data){empty.textContent='No se encontró el banco del piloto.';return;}

    $('adminBankPilotName').textContent='#'+(data.race_number??'--')+' '+(data.nickname||'Piloto');
    $('adminBankPilotContext').textContent=(data.current_team_name||'Sin escudería')+' · '+(data.current_division==='academy'?'Academy':data.current_division==='hyperdrive'?'HyperDrive':'Sin división');
    $('adminBankAvailable').textContent=money(data.available_balance_m)+' M';
    $('adminBankCurrent').textContent=money(data.current_balance_m)+' M';
    $('adminBankReserved').textContent=money(data.reserved_balance_m)+' M';
    renderHistory(historyRes.data||[]);
    empty.classList.add('is-hidden');
    content.classList.remove('is-hidden');
  }

  async function init(){
    const {data:{session}}=await client.auth.getSession();if(!session)return;
    const [adminRes,driversRes]=await Promise.all([
      client.from('user_roles').select('role').eq('user_id',session.user.id).eq('role','admin').maybeSingle(),
      client.from('drivers').select('id,nickname,race_number,is_active').order('nickname')
    ]);
    if(!adminRes.data||driversRes.error)return;
    select.innerHTML='<option value="">Selecciona un piloto</option>';
    (driversRes.data||[]).forEach(d=>{
      const o=document.createElement('option');o.value=d.id;o.textContent='#'+(d.race_number??'--')+' · '+d.nickname+(d.is_active?'':' · INACTIVO');select.appendChild(o);
    });
  }

  select.addEventListener('change',()=>{
    if(!select.value){content.classList.add('is-hidden');empty.textContent='Selecciona un piloto para ver su Banco del Piloto.';empty.classList.remove('is-hidden');return;}
    loadBank(select.value);
  });

  if(!adminContent.classList.contains('is-hidden')) init();
  else{
    const observer=new MutationObserver(()=>{if(!adminContent.classList.contains('is-hidden')){observer.disconnect();init();}});
    observer.observe(adminContent,{attributes:true,attributeFilter:['class']});
  }
})();